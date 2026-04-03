import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC({
  socket,
  roomId,
  mode,
  isInitiator,
  localVideoRef,
  remoteVideoRef,
  localAudioRef,
  remoteAudioRef
}) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const startedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const attachLocalStream = useCallback((stream) => {
    if (mode === 'video' && localVideoRef?.current) {
      localVideoRef.current.srcObject = stream;
    }
    if (mode === 'voice' && localAudioRef?.current) {
      localAudioRef.current.srcObject = stream;
    }
  }, [localAudioRef, localVideoRef, mode]);

  const attachRemoteStream = useCallback((stream) => {
    if (mode === 'video' && remoteVideoRef?.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (mode === 'voice' && remoteAudioRef?.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [mode, remoteAudioRef, remoteVideoRef]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const constraints = mode === 'video'
      ? { audio: true, video: true }
      : { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    attachLocalStream(stream);
    return stream;
  }, [attachLocalStream, mode]);

  const ensurePeerConnection = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const stream = await ensureLocalStream();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket?.emit('webrtc:ice_candidate', { roomId, candidate });
    };
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      attachRemoteStream(remoteStream);
    };

    pcRef.current = pc;
    return pc;
  }, [attachRemoteStream, ensureLocalStream, roomId, socket]);

  const startCall = useCallback(async () => {
    if (!socket || startedRef.current || (mode !== 'voice' && mode !== 'video')) return;
    startedRef.current = true;
    const pc = await ensurePeerConnection();
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { roomId, offer });
    } else {
      socket.emit('webrtc:ready', { roomId });
    }
  }, [ensurePeerConnection, isInitiator, mode, roomId, socket]);

  useEffect(() => {
    if (!socket || (mode !== 'voice' && mode !== 'video')) return undefined;

    const handlePeerReady = async () => {
      if (!isInitiator) return;
      const pc = await ensurePeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { roomId, offer });
    };

    const handleOffer = async ({ offer }) => {
      const pc = await ensurePeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:answer', { roomId, answer });
    };

    const handleAnswer = async ({ answer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleIce = async ({ candidate }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    };

    socket.on('webrtc:peer_ready', handlePeerReady);
    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice_candidate', handleIce);

    return () => {
      socket.off('webrtc:peer_ready', handlePeerReady);
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice_candidate', handleIce);
    };
  }, [ensurePeerConnection, isInitiator, mode, roomId, socket]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    startedRef.current = false;
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return muted;
    const nextMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
    return nextMuted;
  }, [muted]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return videoEnabled;
    const nextEnabled = !videoEnabled;
    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = nextEnabled;
    });
    setVideoEnabled(nextEnabled);
    return nextEnabled;
  }, [videoEnabled]);

  return { startCall, cleanup, toggleMute, toggleVideo, muted, videoEnabled };
}
