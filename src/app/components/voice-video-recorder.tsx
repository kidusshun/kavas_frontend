"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Square } from "lucide-react";

export default function VoiceVideoRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request permissions and set up media streams
  useEffect(() => {
    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setHasPermission(true);
        setPermissionError("");
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setPermissionError(
          "Please allow access to microphone and camera to use this feature."
        );
        setHasPermission(false);
      }
    };

    setupMedia();

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Draw waveform visualization
  const drawWaveform = (
    canvasContext: CanvasRenderingContext2D,
    dataArray: Uint8Array,
    bufferLength: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    canvasContext.fillStyle = "#f8f9fa";
    canvasContext.fillRect(0, 0, width, height);

    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = "#364957";
    canvasContext.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * (height / 2);

      if (i === 0) {
        canvasContext.moveTo(x, y);
      } else {
        canvasContext.lineTo(x, y);
      }

      x += sliceWidth;
    }

    // Draw a vertical orange line at the end to indicate current position
    const lastX = Math.min(x, width);
    canvasContext.stroke();

    canvasContext.beginPath();
    canvasContext.strokeStyle = "#FF8A00";
    canvasContext.lineWidth = 2;
    canvasContext.moveTo(lastX, 0);
    canvasContext.lineTo(lastX, height);
    canvasContext.stroke();
  };

  // Start recording
  const startRecording = () => {
    if (!streamRef.current) return;

    const audioContext = new AudioContext();
    const audioSource = audioContext.createMediaStreamSource(streamRef.current);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    audioSource.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) return;

    // Animation function for waveform
    const animate = () => {
      if (!isRecording) return;

      requestAnimationFrame(animate);
      analyser.getByteTimeDomainData(dataArray);
      drawWaveform(canvasContext, dataArray, bufferLength);
    };

    // Set up MediaRecorder
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      setAudioBlob(audioBlob);
    };

    // Start recording
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    // Start animation
    animate();
  };

  // Stop recording
  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Take a screenshot from the video
      const video = videoRef.current;
      if (!video) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      canvas.toBlob(async (imageBlob) => {
        if (!imageBlob || !audioBlob) return;

        // Send data to backend
        await sendToBackend(audioBlob, imageBlob);
      }, "image/jpeg");
    }
  };

  // Send data to backend
  const sendToBackend = async (audioBlob: Blob, imageBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("image", imageBlob);

      // Replace with your actual API endpoint
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        console.log("Successfully sent recording to backend");
        // You could add success notification here
      } else {
        console.error("Failed to send recording");
        // You could add error notification here
      }
    } catch (error) {
      console.error("Error sending recording:", error);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  if (permissionError) {
    return (
      <Card className="bg-white shadow-lg">
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            <p>{permissionError}</p>
            <Button
              className="mt-4 bg-[#FF8A00] hover:bg-[#e67e22] text-white"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
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

          {isRecording ? (
            <Button
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
              onClick={stopRecording}
              disabled={!hasPermission}
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
              disabled={!hasPermission}
            >
              Start Recording
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Video preview in bottom right corner */}
      <div className="absolute bottom-2 right-2 w-32 h-24 overflow-hidden rounded-md border-2 border-[#364957] shadow-md">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
