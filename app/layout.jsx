import './globals.css';

export const metadata = {
  title: 'Map Earth',
  description: 'Robotic 3D atlas with custom landmarks',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
