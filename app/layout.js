import "./globals.css";

export const metadata = {
  title: "AI 数据分析业务流程助手",
  description: "把模糊的业务需求，转化成清晰的数据分析思路、指标体系和行动建议。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
