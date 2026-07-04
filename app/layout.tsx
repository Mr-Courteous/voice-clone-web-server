export const metadata = {
  title: "Voice Clone Studio",
  description: "Record your voice and speak any text in it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ padding: 40 }}>{children}</body>
    </html>
  );
}
