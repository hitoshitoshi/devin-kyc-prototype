import { ReviewConsole } from "@/components/kyc/review-console";

export default async function ReviewConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewConsole id={id} />;
}
