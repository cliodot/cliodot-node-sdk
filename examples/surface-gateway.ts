import { Surface } from "cliodot";

interface AcmeSurface {
  users: {
    account(): Promise<unknown>;
    create(body: { email: string; name?: string }): Promise<unknown>;
  };
}

async function main() {
  const api = new Surface<AcmeSurface>({
    baseUrl: process.env.GATEWAY_BASE_URL || "https://api.example.com",
    slug: process.env.GATEWAY_SLUG || "acme",
    apiKey: process.env.GATEWAY_API_KEY,
  });

  const account = await api.users.account();
  const created = await api.users.create({ email: "a@b.com" });
  console.log({ account, created });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
