# Kết nối Firebase

Ứng dụng đã được cấu hình cho project `in3d-project`.

## 1. Bật Google Authentication

Firebase Console → Authentication → Sign-in method → Google → Enable → Save.

## 2. Tạo Firestore

Firebase Console → Firestore Database → Create database → Production mode → chọn vị trí → Create.

Mở tab Rules, thay toàn bộ nội dung bằng nội dung trong `firestore.rules`, sau đó bấm Publish.

## 3. Cho phép domain GitHub Pages

Sau khi có URL GitHub Pages, vào Authentication → Settings → Authorized domains → Add domain.

Chỉ nhập hostname, ví dụ:

```
ten-github.github.io
```

Không nhập `https://`, đường dẫn repo hoặc dấu `/`.

## 4. Chạy thử trên máy

Đăng nhập Firebase không hoạt động khi mở trực tiếp bằng `file://`. Chạy thư mục qua HTTP:

```powershell
python -m http.server 4173 --directory .
```

Sau đó mở `http://localhost:4173` và thêm `localhost` vào Authorized domains nếu chưa có.

## Dữ liệu được lưu ở đâu?

- Dữ liệu chính: `users/{uid}/app/data`
- Ảnh đã nén: `users/{uid}/images/{productId}`
- `localStorage` vẫn được giữ làm bản dự phòng khi mất mạng hoặc chưa đăng nhập.
