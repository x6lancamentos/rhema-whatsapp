import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ status: false, message: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".bin";
    const cleanBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueFilename = `${cleanBase}-${Date.now()}${ext}`;

    const mediaDir = path.join(process.cwd(), "public", "media");
    await mkdir(mediaDir, { recursive: true });

    const filePath = path.join(mediaDir, uniqueFilename);
    await writeFile(filePath, buffer);

    const publicUrl = `/media/${uniqueFilename}`;

    return NextResponse.json({
      status: true,
      message: "Arquivo enviado com sucesso",
      data: {
        url: publicUrl,
        filename: uniqueFilename,
        size: buffer.length,
        type: file.type,
      },
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { status: false, message: "Falha ao enviar arquivo", error: error.message },
      { status: 500 }
    );
  }
}
