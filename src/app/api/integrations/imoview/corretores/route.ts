import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { fetchImoviewBrokers } from "@/lib/imoview";

// GET: Fetch list of brokers from Imoview for filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ status: false, message: "Unauthorized" }, { status: 401 });
    }

    const brokers = await fetchImoviewBrokers();

    return NextResponse.json({
      status: true,
      data: brokers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: false, message: "Erro ao buscar corretores", error: error.message },
      { status: 500 }
    );
  }
}
