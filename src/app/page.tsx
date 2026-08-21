import { GroovePuzzle } from "@/features/daily-groove";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Daily Groove
        </h1>
        <GroovePuzzle />
      </main>
    </div>
  );
}
