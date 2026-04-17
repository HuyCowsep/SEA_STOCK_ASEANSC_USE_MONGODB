<!-- markdownlint-disable -->

Các nguyên tắc hành vi nhằm giảm những lỗi phổ biến khi LLM viết code.  
Có thể kết hợp với hướng dẫn riêng của từng project khi cần.

> ⚠️ Đánh đổi: Các nguyên tắc này ưu tiên **sự cẩn trọng hơn tốc độ**.  
> Với các task đơn giản, hãy tự cân nhắc.

---

## 1. Suy nghĩ trước khi code

**Đừng giả định. Đừng che giấu sự không chắc chắn. Hãy làm rõ các đánh đổi.**

Trước khi bắt đầu implement:

- Nêu rõ các giả định của bạn. Nếu không chắc → hãy hỏi.
- Nếu có nhiều cách hiểu → trình bày tất cả (đừng tự chọn một cách im lặng).
- Nếu có cách đơn giản hơn → hãy nói ra.
- Sẵn sàng phản biện nếu cần.
- Nếu có gì chưa rõ → dừng lại, chỉ ra điểm gây bối rối và hỏi.

---

## 2. Ưu tiên đơn giản

**Viết lượng code tối thiểu để giải quyết vấn đề. Không thêm thắt suy đoán.**

### ❌ Không làm:

- Không thêm tính năng ngoài yêu cầu.
- Không tạo abstraction cho code chỉ dùng một lần.
- Không thêm “tính linh hoạt” hoặc “config” nếu không được yêu cầu.
- Không xử lý lỗi cho những trường hợp không thể xảy ra.

### ✅ Nguyên tắc:

- Nếu viết 200 dòng mà có thể làm trong 50 dòng → **viết lại**.

### 🧠 Tự hỏi:

> “Một senior engineer có thấy đoạn này overcomplicated không?”

→ Nếu có → đơn giản hóa.

---

## 3. Thay đổi có chọn lọc

**Chỉ động vào phần cần thiết. Chỉ dọn dẹp những gì bạn gây ra.**

### Khi chỉnh sửa code có sẵn:

- ❌ Không “tiện tay cải thiện” code xung quanh.
- ❌ Không refactor những thứ không bị lỗi.
- ❌ Không sửa comment / format không liên quan.
- ✅ Tuân theo style hiện tại (dù bạn không thích).

---

### Khi thay đổi của bạn tạo ra phần thừa:

- ✅ Xóa:
  - import không dùng
  - biến không dùng
  - function không dùng  
    _(nếu do thay đổi của bạn gây ra)_

- ❌ Không xóa:
  - dead code có sẵn từ trước (nếu không được yêu cầu)

---

### 🧪 Bài test:

> Mỗi dòng thay đổi phải truy ngược được về yêu cầu của người dùng.

---

## 4. Thực thi theo mục tiêu

**Xác định tiêu chí thành công. Lặp lại cho đến khi kiểm chứng được.**

### Biến task thành mục tiêu có thể kiểm chứng:

- “Thêm validation”  
  → Viết test cho input sai → làm cho test pass

- “Fix bug”  
  → Viết test tái hiện bug → sửa để pass

- “Refactor X”  
  → Đảm bảo test pass trước và sau

---

### Với task nhiều bước:

Viết plan ngắn:

1. [Bước] → kiểm tra: [cách verify]
2. [Bước] → kiểm tra: [cách verify]
3. [Bước] → kiểm tra: [cách verify]

---

### 🎯 Ghi nhớ:

- Tiêu chí rõ ràng → tự lặp & verify được
- Tiêu chí mơ hồ (“làm cho nó chạy”) → phải hỏi lại liên tục

---

## 📌 Trích dẫn từ Github (Andrej)

> “The models make wrong assumptions on your behalf and just run along with them without checking.  
> They don't manage their confusion, don't seek clarifications, don't surface inconsistencies, don't present tradeoffs, don't push back when they should.”

> “They really like to overcomplicate code and APIs, bloat abstractions, don't clean up dead code... implement a bloated construction over 1000 lines when 100 would do.”

> “They still sometimes change/remove comments and code they don't sufficiently understand as side effects, even if orthogonal to the task.”

---

## 🧠 Tóm tắt 1 dòng

> **Think first → Keep it simple → Change only what's needed → Verify everything**
