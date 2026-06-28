# Firebase + workspace gia đình

Ứng dụng dùng project `in3d-project` và mô hình workspace dùng chung.

## Bắt buộc: cập nhật Firestore Rules

1. Firebase Console → Firestore Database → Rules.
2. Xoá rules cũ.
3. Dán toàn bộ nội dung file `firestore.rules`.
4. Bấm Publish.

Rules mới cho phép:

- Mỗi người dùng quản lý hồ sơ riêng.
- Thành viên trong cùng workspace đọc chung dữ liệu.
- Owner/editor được sửa; viewer chỉ được xem.
- Người được mời chỉ có thể tham gia bằng đúng email Google trong lời mời.
- Đường dẫn `users/{uid}` cũ vẫn được đọc để tự động migrate dữ liệu.

## Bật Google Authentication

Firebase Console → Authentication → Sign-in method → Google → Enable → Save.

## Cho phép domain GitHub Pages

Authentication → Settings → Authorized domains → Add domain.

Chỉ nhập hostname, ví dụ `ten-github.github.io`, không nhập `https://` hoặc đường dẫn repo.

## Luồng sử dụng

1. Chủ xưởng đăng nhập lần đầu. App tự tạo workspace và chuyển dữ liệu cũ vào đó.
2. Mở trang Thành viên.
3. Nhập chính xác email Google của vợ/em, chọn quyền và tạo link.
4. Gửi link đó cho đúng người.
5. Người nhận mở link và đăng nhập đúng email được mời.

## Cấu trúc dữ liệu

```text
workspaces/{workspaceId}
  members/{uid}
  app/data
  images/{productId}

users/{uid}/profile/main
invites/{inviteToken}
```
