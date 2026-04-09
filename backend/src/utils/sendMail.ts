import nodemailer from "nodemailer";

export const sendOTP = async (to: string, otp: string) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Mã OTP đổi mật khẩu",
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Mã OTP của bạn là:</h2>
        <h1 style="color: green;">${otp}</h1>
        <p>Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        <p>Mã có hiệu lực trong 5 phút.</p>
      </div>
    `,
  });
};
