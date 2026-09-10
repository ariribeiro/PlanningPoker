import PokerRoom from "./PokerRoom";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PokerRoom roomId={id} />;
}
