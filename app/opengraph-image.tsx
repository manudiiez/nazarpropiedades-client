import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nazar Propiedades";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#171717",
          color: "#ffffff",
          fontSize: 64,
          padding: 80,
        }}
      >
        <div>Nazar Propiedades</div>
        <div style={{ fontSize: 32 }}>Casas, departamentos y terrenos en Mendoza</div>
      </div>
    ),
    size,
  );
}
