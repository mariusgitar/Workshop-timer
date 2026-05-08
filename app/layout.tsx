import type { Metadata } from “next”;

export const metadata: Metadata = {
title: “Workshop Timer”,
description: “Enkel timer for workshops”,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="no">
<body style={{ margin: 0, padding: 0 }}>{children}</body>
</html>
);
}
