# Khoá luận tốt nghiệp (LaTeX, mẫu UET)

Bản LaTeX của khoá luận về AI-CORP, dùng lớp tài liệu
[uet-graduation-latex](https://github.com/leduyquang753/uet-graduation-latex)
(`uetgraduation.cls`, `sizes.clo`, `UET logo.pdf` giữ nguyên từ mẫu gốc).

## Biên dịch

Lớp `uetgraduation` yêu cầu **LuaLaTeX** và phông **Times New Roman** (có sẵn trên Windows).

```bash
latexmk -lualatex main.tex      # hoặc chạy lualatex main.tex ba lần
```

Trên Windows (MiKTeX hoặc TeX Live) chỉ cần mở `main.tex` bằng TeXstudio/VS Code,
chọn trình biên dịch LuaLaTeX. Gói cần có: fontspec, mathfont, siunitx, icomma,
tabularx, multirow, fancyvrb, tikz, hyperref.

## Cấu trúc

| Đường dẫn | Nội dung |
|-----------|----------|
| `main.tex` | Tệp chính: thông tin bìa, thứ tự chương |
| `chuong/00-dau-sach.tex` | Lời cam đoan, lời cảm ơn, tóm tắt, abstract |
| `chuong/01..08-*.tex` | Tám chương |
| `chuong/90-tai-lieu-tham-khao.tex` | Tài liệu tham khảo |
| `chuong/95-phu-luc.tex` | Phụ lục A–D |
| `hinh/puml/` | Mã PlantUML của 16 sơ đồ vẽ lại bằng tiếng Việt |
| `hinh/sodo/` | Các sơ đồ trên, đã xuất PDF |
| `hinh/uml/` | 39 sơ đồ gốc từ `docs/diagrams/rendered/`, xuất PDF |
| `hinh/anh/` | Ảnh chụp giao diện Ant Design 6 (chế độ sáng) trên dữ liệu `scripts/demo/seed-demo.mjs` |

## Vẽ lại sơ đồ

```bash
cd hinh
for f in puml/*.puml; do java -jar plantuml.jar -tsvg -o ../sodo "$f"; done
for f in sodo/*.svg; do rsvg-convert -f pdf -o "${f%.svg}.pdf" "$f" && rm "$f"; done
```

## Chụp lại ảnh giao diện

Các ảnh trong `hinh/anh/` được chụp bằng Playwright ở khung 1440×900, tỉ lệ điểm ảnh 2,
chế độ sáng (đặt `ui-theme` trong localStorage thành `light`), trên hệ thống chạy theo
`docs/phase7-e2e/README.md` và dữ liệu của `scripts/demo/seed-demo.mjs`. Ảnh `meeting-room.png`
chụp trong lúc tạo thêm một dự án mới, vì Phòng họp chỉ hiện trao đổi đang diễn ra.

## Cần điền trước khi nộp

- `\studentname{...}` trong `main.tex` và chữ ký ở lời cam đoan (`chuong/00-dau-sach.tex`).
- Kiểm tra lại học hàm, học vị của cán bộ hướng dẫn và tên ngành.
- Lời cảm ơn là bản nháp, nên sửa theo lời của chính tác giả.
