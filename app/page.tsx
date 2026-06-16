import { headers } from "next/headers";
import TrackerClient from "./tracker-client";

function displayNameFromHeaders(requestHeaders: Headers) {
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  return fullName ?? email ?? "local-user";
}

export default async function Home() {
  const requestHeaders = await headers();
  return <TrackerClient displayName={displayNameFromHeaders(requestHeaders)} />;
}
