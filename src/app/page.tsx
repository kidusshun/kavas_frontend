import VoiceVideoRecorder from "@/components/voice-video-recorder";
import Logo from "@/components/logo";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="w-full py-4 px-6">
        <Logo className="h-12 w-auto" />
      </header>
      <main className="flex flex-col items-center justify-center p-4 mt-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-6 text-[#364957]">
            Voice Recorder
          </h1>
          <VoiceVideoRecorder />
        </div>
      </main>
    </div>
  );
}
