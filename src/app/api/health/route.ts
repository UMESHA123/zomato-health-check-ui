export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    status: "UP",
    service: "health-check-ui",
    timestamp: new Date().toISOString(),
  });
}
