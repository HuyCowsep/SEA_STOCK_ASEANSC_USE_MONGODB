import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Account from "../models/Account";
import { AuthRequest } from "../middleware/auth";
import { sendOTP } from "../utils/sendMail";

const SALT_ROUNDS = 10;
const OTP_EXPIRE_MS = 5 * 60 * 1000;

const normalizeString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const normalizePassword = (value: unknown): string => (typeof value === "string" ? value : "");
const normalizeEmail = (value: unknown): string => normalizeString(value).toLowerCase();

const signToken = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("Thiếu biến môi trường JWT_SECRET");
  }
  return jwt.sign({ userId }, jwtSecret, { expiresIn: "1d" });
};

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const register = async (req: Request, res: Response) => {
  try {
    const username = normalizeString(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = normalizePassword(req.body?.password);

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Thiếu username, email hoặc password" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu tối thiểu 6 ký tự" });
    }

    const existedUser = await User.findOne({ username });
    if (existedUser) return res.status(400).json({ message: "Username đã tồn tại" });

    const existedEmail = await User.findOne({ email });
    if (existedEmail) return res.status(400).json({ message: "Email đã tồn tại" });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await User.create({ username, email, password: hashedPassword });

    // Tạo tài khoản tiền cho user mới — bắt đầu từ 0 đồng, phải nạp tiền ảo
    await Account.create({ userId: newUser._id, available: 0, locked: 0 });

    const token = signToken(String(newUser._id));

    return res.json({
      message: "Đăng ký thành công",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("[auth.register] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const login = async (req: Request, res: Response) => {
  try {
    const username = normalizeString(req.body?.username);
    const password = normalizePassword(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password" });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Tài khoản hoặc mật khẩu không đúng" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Tài khoản hoặc mật khẩu không đúng" });

    const token = signToken(String(user._id));
    return res.json({ message: "Đăng nhập thành công", token });
  } catch (error) {
    console.error("[auth.login] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const user = await User.findById(userId).select("_id username email fullName nickname phone dateOfBirth cccd status createdAt").lean();
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const account = await Account.findOne({ userId }).select("bankAccount").lean();

    return res.json({
      user: {
        id: String(user._id),
        username: user.username,
        email: user.email,
        fullName: user.fullName || "",
        nickname: user.nickname || "",
        phone: user.phone || "",
        dateOfBirth: user.dateOfBirth || "",
        cccd: user.cccd || "",
        status: user.status || "active",
        accountNumber: account?.bankAccount || "",
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[auth.getMe] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const requestPasswordOtp = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Thiếu email" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    const otp = generateOtpCode();
    user.otp = otp;
    user.otpExpire = new Date(Date.now() + OTP_EXPIRE_MS);
    await user.save();

    await sendOTP(email, otp);

    return res.json({
      message: "Đã gửi OTP. OTP có hiệu lực trong 5 phút",
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error("[auth.requestPasswordOtp] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const resetPasswordWithOtp = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = normalizeString(req.body?.otp);
    const newPassword = normalizePassword(req.body?.newPassword);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Thiếu email, OTP hoặc mật khẩu mới" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới tối thiểu 6 ký tự" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.otp || !user.otpExpire) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "OTP không đúng" });
    }

    if (user.otpExpire.getTime() < Date.now()) {
      user.otp = undefined;
      user.otpExpire = undefined;
      await user.save();
      return res.status(400).json({ message: "OTP đã hết hạn, vui lòng gửi lại OTP" });
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    return res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("[auth.resetPasswordWithOtp] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// ===================================================================
// PUT /api/auth/profile — Cập nhật thông tin cá nhân (cần đăng nhập)
// ===================================================================
const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Chưa đăng nhập" });

    // Chỉ cho phép update các field này, KHÔNG được đổi username/email/password/status qua đây
    const ALLOWED = ["fullName", "nickname", "phone", "dateOfBirth", "cccd"] as const;
    type AllowedField = (typeof ALLOWED)[number];

    const updates: Partial<Record<AllowedField, string>> = {};

    for (const field of ALLOWED) {
      const val = req.body?.[field];
      if (typeof val === "string") {
        updates[field] = val.trim();
      }
    }

    // Validate phone nếu có đầu vào
    if (updates.phone && !/^[0-9\s+\-().]{7,15}$/.test(updates.phone)) {
      return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
    }

    // Validate CCCD nếu có: chỉ chấp nhận 9 hoặc 12 chữ số
    if (updates.cccd && !/^\d{9}$|^\d{12}$/.test(updates.cccd)) {
      return res.status(400).json({ message: "CCCD không hợp lệ (9 hoặc 12 chữ số)" });
    }

    // Validate ngày sinh nếu có: định dạng YYYY-MM-DD
    if (updates.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(updates.dateOfBirth)) {
      return res.status(400).json({ message: "Ngày sinh không hợp lệ (YYYY-MM-DD)" });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Không có thông tin nào được gửi lên" });
    }

    const user = await User.findByIdAndUpdate(userId, { $set: updates }, { returnDocument: "after" })
      .select("username email fullName nickname phone dateOfBirth cccd status createdAt")
      .lean();

    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    return res.json({
      message: "Cập nhật thông tin thành công",
      user: {
        id: String(user._id),
        username: user.username,
        email: user.email,
        fullName: user.fullName || "",
        nickname: user.nickname || "",
        phone: user.phone || "",
        dateOfBirth: user.dateOfBirth || "",
        cccd: user.cccd || "",
        status: user.status || "active",
      },
    });
  } catch (error) {
    console.error("[auth.updateProfile] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// ===================================================================
// POST /api/auth/change-password — Đổi mật khẩu (cần mật khẩu cũ, không cần OTP)
// ===================================================================
const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Chưa đăng nhập" });

    const oldPassword = normalizePassword(req.body?.oldPassword);
    const newPassword = normalizePassword(req.body?.newPassword);
    const confirmPassword = normalizePassword(req.body?.confirmPassword);

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới tối thiểu 6 ký tự" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu mới và xác nhận không khớp" });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ message: "Mật khẩu mới phải khác mật khẩu cũ" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu cũ không đúng" });
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    return res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("[auth.changePassword] error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

export { register, login, requestPasswordOtp, resetPasswordWithOtp, updateProfile, changePassword };
