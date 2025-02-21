var socket = io.connect(window.location.origin);

// global mic activateion flag and info flag
let micActive = false;
let websiteInfoMore = true;

function updateMicInfo(){
    if (micActive){
        // change the mic icon and info to show that audio is being tranfer
        document.getElementById('MicIcon').setAttribute('src','static/img/mic_icon_on.png');
        document.getElementById('MicInfo').innerHTML = '(Microphone is ON)';
    } else {
        // change the mic icon and info to show that audio is being tranfer
        document.getElementById('MicIcon').setAttribute('src','static/img/mic_icon_off.png');
        document.getElementById('MicInfo').innerHTML = '(Microphone is OFF)';
    }
}

function generate_welcomeMsg(){
    
    // Random message generator for each used on Arrival
    const welcomeMsgs = [
        'here/there',
        'you are remote',
        'miles of line'
    ];

    let msg_len = welcomeMsgs.length;
    let rand_msg;

    // generate a random number
    rand_msg = welcomeMsgs[Math.floor(Math.random()*msg_len)];
    // update the welcome text with random number
    document.getElementById('sender_welcome').innerHTML = rand_msg;

}

function hideUnhideWebsiteInfo(){
    
    // flip the flag
    websiteInfoMore = !websiteInfoMore;
    // get list of all info to hide or unhide
    const moreInfoList = document.getElementsByClassName("more-websiteInfo");

    // depending on the flag - change info text and hide/unhide instructions
    if (websiteInfoMore){
        document.getElementById('websiteInfoMoreButton').innerHTML = "<u>(more info)</u>";
        for(let i=0; i<moreInfoList.length; i++){
            // this class has a display none porperty
            moreInfoList[i].classList.add("audio-inactive-off");
        }
    } else {
        document.getElementById('websiteInfoMoreButton').innerHTML = "<u>(less info)</u>";
        for(let i=0; i<moreInfoList.length; i++){
            moreInfoList[i].classList.remove("audio-inactive-off");
        }
    }

}

function setupSenderUI(){
    generate_welcomeMsg();
    updateMicInfo();
}

// STUN Server for NAT traversal
async function fetchIceConfig() {
    try {
        const response = await fetch(window.location.origin + "/ice-config");
        const iceConfig = await response.json();
        return iceConfig;
    } catch (error) {
        console.error("Failed to fetch ICE config:", error);
        return { iceServers: [] };  // Fallback to an empty config
    }
}


const aud_effect_constraints = {
    echoCancellation : false
};

async function sendAudioStream() {
    // access the default mic of the device
    let stream;

    const rtcConfig = await fetchIceConfig();
    console.log(rtcConfig);
    
    console.log('0 - Function started');
    try{
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    }
    catch
    {
        console.log("Mic Permission dismissed");
        return;
    }
    
    console.log('1 - Audio found and added to stream');
    
    
    // make a p2p connection
    const peerConnection = new RTCPeerConnection(rtcConfig);
    stream.getTracks().forEach(track => {
        track.applyConstraints(aud_effect_constraints);
        peerConnection.addTrack(track, stream);
        console.log('XX - Track added to P2P', stream)
    });

    console.log('2 - PeerConnection variable made and stream added to it');

    // check for ice errors
    peerConnection.onicecandidateerror = (event) => {
        console.error("ICE Candidate Error:", event);
    };
    
    
    // send the input audio as an offer
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, senderId: socket.id });
            console.log(event.candidate.candidate);
            console.log('XX - socket candidate emitted');

        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('3 - Offer generated');
    socket.emit('offer', {offer, senderId: socket.id });
    console.log('4 - socket Offer emitted');

    
    socket.on('answer', async ({ answer, remoteSenderID }) => {
        if(remoteSenderID == socket.id){
            // Set the remote description with the answer received from the receiver
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('XX - anser received and added for peer connection');
        }
    });

    // Handle ICE candidates from receiver
    socket.on('candidateRec', ({ candidate, originalSenderId }) => {
        console.log("CANDIDATE_REC", originalSenderId);
        if (originalSenderId == socket.id) {
            console.log("CANDIDATE_REC_PASS", candidate.candidate, originalSenderId);
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    // Handle when receiver closes the stream
    socket.on('byeBye', (event) => {
        peerConnection.close();
        // update mic info
        console.log('receiver byebye');
        micActive = false;
        updateMicInfo();
    });

    // update mic info
    micActive = true;
    updateMicInfo();

}



