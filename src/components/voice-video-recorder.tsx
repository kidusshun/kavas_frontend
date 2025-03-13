"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Square,
  Mic,
  Video,
  VideoOff,
  Send,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function VoiceVideoRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
  const [videoPermission, setVideoPermission] = useState<boolean | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [responseAudio, setResponseAudio] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopAllTracks();
    };
  }, []);

  const ensureVideoDisplay = () => {
    if (videoRef.current && videoStreamRef.current) {
      videoRef.current.srcObject = videoStreamRef.current;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err);
          });
        }
      };
    }
  };

  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVideoActive(false);
  };

  const resetRecording = () => {
    setHasRecording(false);
    setAudioBlob(null);
    audioChunksRef.current = [];
    setResponseAudio(null);
  };

  const requestAudioPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioPermission(true);
      return stream;
    } catch (err) {
      console.error("Error accessing audio:", err);
      setAudioPermission(false);
      toast({
        title: "Audio Permission Denied",
        description: "Please allow access to your microphone to record audio.",
        variant: "destructive",
      });
      return null;
    }
  };

  const requestVideoPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      setVideoPermission(true);
      setVideoActive(true);
      videoStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch((err) => {
              console.error("Error playing video:", err);
            });
          }
        };
      }

      return stream;
    } catch (err) {
      console.error("Error accessing video:", err);
      setVideoPermission(false);
      toast({
        title: "Video Permission Denied",
        description:
          "Video recording will be disabled. You can still record audio.",
        variant: "destructive",
      });
      return null;
    }
  };

  const startRecording = async () => {
    resetRecording();
    stopAllTracks();

    const audioStream = await requestAudioPermission();
    if (!audioStream) return;

    const videoStream = await requestVideoPermission();
    if (videoStream) {
      videoStreamRef.current = videoStream;
      setTimeout(() => {
        ensureVideoDisplay();
      }, 500);
    }

    streamRef.current = audioStream;

    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(audioStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    audioSource.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) return;

    const animate = () => {
      requestAnimationFrame(animate);

      if (isRecording && analyser && canvasContext) {
        analyser.getByteTimeDomainData(dataArray);
        drawWaveform(canvasContext, dataArray, bufferLength);
      }
    };

    const mediaRecorder = new MediaRecorder(audioStream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/wav", // Changed from ogg to wav to match your implementation
      });
      setAudioBlob(audioBlob);
      setHasRecording(true);
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    animate();
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    }
  };

  const sendRecording = async () => {
    if (!audioBlob) return;
    setIsSending(true);

    try {
      let imageBlob: Blob | undefined;

      if (videoPermission && videoRef.current) {
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          imageBlob = await new Promise((resolve) =>
            canvas.toBlob(resolve as BlobCallback, "image/jpeg")
          );
        }
      }

      // Function to download a file
      const downloadFile = (blob: Blob, filename: string) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      // Simulate sending to backend
      const formData = new FormData();
      formData.append("audio", audioBlob);
      if (imageBlob) {
        formData.append("image", imageBlob);
      }

      const response = await fetch(
        "http://127.0.0.1:8001/user/process_request",
        {
          method: "POST",
          body: formData,
          timeout: 300000, // Set timeout to 60 seconds
        }
      );

      if (response.ok) {
        const responseData = await response.blob();

        const audioBlob = new Blob([responseData], {
          type: "audio/wav", // Use the correct audio type (wav, mp3, etc.)
        });

        const audioUrl = URL.createObjectURL(audioBlob);

        setResponseAudio(audioUrl);
        toast({
          title: "Success",
          description: "Recording sent successfully",
        });
        setHasRecording(false);
        audioChunksRef.current = [];
      } else {
        throw new Error("Failed to send recording");
      }
    } catch (error) {
      console.error("Error preparing recording:", error);
      toast({
        title: "Error",
        description: "Failed to prepare recording",
        variant: "destructive",
      });
      resetRecording();
    } finally {
      setIsSending(false);
      setIsRecording(false);
    }

    stopAllTracks();
  };

  const drawWaveform = (
    canvasContext: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    bufferLength: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, width, height);

    canvasContext.beginPath();
    canvasContext.setLineDash([2, 2]);
    canvasContext.strokeStyle = "#cccccc";
    canvasContext.lineWidth = 1;
    canvasContext.moveTo(0, height / 2);
    canvasContext.lineTo(width, height / 2);
    canvasContext.stroke();
    canvasContext.setLineDash([]);

    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = "#3366CC";

    const amplitudeMultiplier = 1.5;

    const barWidth = 2;
    const barGap = 3;
    const totalBars = Math.floor(width / (barWidth + barGap));
    const samplesPerBar = Math.floor(bufferLength / totalBars);

    for (let i = 0; i < totalBars; i++) {
      // Get average of data for this bar
      let sum = 0;
      const startIndex = i * samplesPerBar;
      for (let j = 0; j < samplesPerBar && startIndex + j < bufferLength; j++) {
        sum += Math.abs(dataArray[startIndex + j] - 128) / 128;
      }
      const amplitude =
        (sum / samplesPerBar) * (height / 2) * 0.9 * amplitudeMultiplier;

      // Draw vertical bar
      const x = i * (barWidth + barGap);
      canvasContext.beginPath();
      canvasContext.moveTo(x, height / 2 - amplitude);
      canvasContext.lineTo(x, height / 2 + amplitude);
      canvasContext.lineWidth = barWidth;
      canvasContext.stroke();
    }

    const progressX = (recordingTime / 30) * width; // Assuming 30s max recording
    canvasContext.beginPath();
    canvasContext.strokeStyle = "#FF3333";
    canvasContext.lineWidth = 2;
    canvasContext.moveTo(progressX, 0);
    canvasContext.lineTo(progressX, height);
    canvasContext.stroke();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="relative min-h-[400px]">
      <Card className="shadow-lg bg-white rounded-lg overflow-hidden">
        <CardContent className="p-6">
          <div className="text-right text-[#364957] mb-2">
            {formatTime(recordingTime)}
          </div>

          <div className="bg-gray-50 rounded-md p-2 mb-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={100}
              className="w-full"
            />
          </div>

          {responseAudio && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <h3 className="font-medium text-sm text-gray-700 mb-2">
                Response Audio
              </h3>
              <audio
                controls
                className="w-full"
                src={responseAudio}
                onError={() => {
                  toast({
                    title: "Error",
                    description: "Could not play the response audio",
                    variant: "destructive",
                  });
                  setResponseAudio(null);
                }}
              />
              <Button
                className="mt-3 w-full bg-gray-100 hover:bg-gray-200 text-gray-700"
                onClick={resetRecording}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Record New Message
              </Button>
            </div>
          )}

          {hasRecording ? (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#FF8A00] hover:bg-[#e67e22] text-white"
                onClick={sendRecording}
                disabled={isSending}
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                <span className="ml-2">
                  {isSending ? "Sending..." : "Send"}
                </span>
              </Button>
              <Button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                onClick={startRecording}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Record Again
              </Button>
            </div>
          ) : isRecording ? (
            <Button
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
              onClick={stopRecording}
            >
              <div className="flex items-center justify-center">
                <Square className="h-4 w-4 mr-2" />
                stop recording
              </div>
            </Button>
          ) : (
            <Button
              className="w-full bg-[#FF8A00] hover:bg-[#e67e22] text-white"
              onClick={startRecording}
            >
              <Mic className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          )}

          <div className="mt-4 flex justify-center">
            {videoPermission === false ? (
              <VideoOff className="text-red-500" />
            ) : videoPermission === true ? (
              <Video className="text-green-500" />
            ) : null}
            {audioPermission === false ? (
              <Mic className="text-red-500 ml-2" />
            ) : audioPermission === true ? (
              <Mic className="text-green-500 ml-2" />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {videoPermission && (videoRef.current?.srcObject || isRecording) && (
        <div className="fixed bottom-4 right-4 w-64 h-48 overflow-hidden rounded-xl shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover bg-gray-900"
          />
        </div>
      )}
    </div>
  );
}
