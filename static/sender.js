async function getAudioStream(params) {
    // access the default mic of the device
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });    
    // make a p2p connection
    const peerConnection = new RTCPeerConnection();
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

    console.log(stream);
    console.log(peerConnection);
}
