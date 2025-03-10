import VoiceVideoRecorder from "@/components/voice-video-recorder";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-[#364957]">
          Voice Recorder
        </h1>
        <VoiceVideoRecorder />
      </div>
    </main>
  );
}
