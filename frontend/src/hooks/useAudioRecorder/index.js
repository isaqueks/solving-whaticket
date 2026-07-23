import { useState } from "react";
import MicRecorder from "mic-recorder-to-mp3";

const Mp3Recorder = new MicRecorder({ bitRate: 128 });

/**
 * Gravação de áudio em mp3 (mic-recorder-to-mp3), movida tal-qual do
 * MessageInputCustom:
 *
 * - startRecording: pede permissão de microfone e inicia a gravação.
 * - stopRecording: para e resolve com o Blob mp3; `recording` volta a false
 *   mesmo se o stop falhar (mesma garantia do original).
 * - cancelRecording: para e descarta o Blob; se o stop falhar, o erro propaga
 *   e `recording` fica true (comportamento original preservado).
 *
 * Erros propagam para o chamador tratar (toastError no componente). O timer
 * visual continua sendo o componente RecordingTimer, que é autocontido.
 */
const useAudioRecorder = () => {
  const [recording, setRecording] = useState(false);

  const startRecording = async () => {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    await Mp3Recorder.start();
    setRecording(true);
  };

  const stopRecording = async () => {
    try {
      const [, blob] = await Mp3Recorder.stop().getMp3();
      return blob;
    } finally {
      setRecording(false);
    }
  };

  const cancelRecording = async () => {
    await Mp3Recorder.stop().getMp3();
    setRecording(false);
  };

  return { recording, startRecording, stopRecording, cancelRecording };
};

export default useAudioRecorder;
