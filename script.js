```javascript
/* =========================================
   CONEXIÓN ARDUINO
========================================= */

let port = null;
let reader = null;
let writer = null;


/* =========================================
   TEMPORIZADOR
========================================= */

let totalSeconds = 60;

let remainingSeconds = 60;

let timerRunning = false;

let endTime = 0;

let timerInterval = null;


/* =========================================
   LED
========================================= */

let ledBrightness = 0;


/* =========================================
   ELEMENTOS
========================================= */

const connectButton =
    document.getElementById("connectButton");

const disconnectButton =
    document.getElementById("disconnectButton");

const saveButton =
    document.getElementById("saveButton");

const startButton =
    document.getElementById("startButton");

const pauseButton =
    document.getElementById("pauseButton");

const resetButton =
    document.getElementById("resetButton");

const connectionStatus =
    document.getElementById("connectionStatus");

const timerDisplay =
    document.getElementById("timerDisplay");

const minutesInput =
    document.getElementById("minutesInput");

const secondsInput =
    document.getElementById("secondsInput");

const ledIndicator =
    document.getElementById("ledIndicator");

const ledState =
    document.getElementById("ledState");

const movementValue =
    document.getElementById("movementValue");

const movementMarker =
    document.getElementById("movementMarker");

const bpmValue =
    document.getElementById("bpmValue");


/* =========================================
   ESTADO DE CONEXIÓN
========================================= */

function setConnectionStatus(text, connected) {

    connectionStatus.textContent =
        "● " + text;

    if (connected) {

        connectionStatus.className =
            "status connected";

    } else {

        connectionStatus.className =
            "status disconnected";

    }

}


/* =========================================
   MOSTRAR TIEMPO
========================================= */

function formatTime(seconds) {

    seconds =
        Math.max(
            0,
            Math.floor(seconds)
        );


    const hours =
        Math.floor(
            seconds / 3600
        );


    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );


    const secs =
        seconds % 60;


    return (
        String(hours).padStart(2, "0")
        + ":" +
        String(minutes).padStart(2, "0")
        + ":" +
        String(secs).padStart(2, "0")
    );

}


/* =========================================
   ACTUALIZAR TEMPORIZADOR
========================================= */

function updateTimer() {

    if (timerRunning) {

        remainingSeconds =
            Math.max(
                0,
                Math.ceil(
                    (endTime - Date.now()) / 1000
                )
            );


        if (remainingSeconds <= 0) {

            timerRunning = false;

            clearInterval(
                timerInterval
            );

            timerInterval = null;


            remainingSeconds = 0;


            sendCommand(
                "TIMER_DONE"
            );

        }

    }


    timerDisplay.textContent =
        formatTime(
            remainingSeconds
        );

}


/* =========================================
   INICIAR
========================================= */

function startTimer() {

    if (remainingSeconds <= 0) {

        remainingSeconds =
            totalSeconds;

    }


    timerRunning = true;


    endTime =
        Date.now()
        +
        remainingSeconds * 1000;


    clearInterval(
        timerInterval
    );


    timerInterval =
        setInterval(
            updateTimer,
            100
        );


    updateTimer();

}


/* =========================================
   PAUSAR
========================================= */

function pauseTimer() {

    if (!timerRunning)
        return;


    updateTimer();


    timerRunning = false;


    clearInterval(
        timerInterval
    );


    timerInterval = null;

}


/* =========================================
   REINICIAR
========================================= */

function resetTimer() {

    timerRunning = false;


    clearInterval(
        timerInterval
    );


    timerInterval = null;


    remainingSeconds =
        totalSeconds;


    updateTimer();

}


/* =========================================
   CONECTAR ARDUINO
========================================= */

connectButton.addEventListener(
    "click",
    async () => {

        if (!("serial" in navigator)) {

            alert(
                "Tu navegador no soporta Web Serial. Usa Chrome o Edge."
            );

            return;

        }


        try {

            port =
                await navigator.serial.requestPort();


            await port.open({
                baudRate: 115200
            });


            writer =
                port.writable.getWriter();


            connectButton.disabled =
                true;


            disconnectButton.disabled =
                false;


            saveButton.disabled =
                false;


            startButton.disabled =
                false;


            pauseButton.disabled =
                false;


            resetButton.disabled =
                false;


            setConnectionStatus(
                "Arduino conectado",
                true
            );


            readArduino();

        }

        catch (error) {

            console.error(error);


            setConnectionStatus(
                "Error de conexión",
                false
            );

        }

    }
);


/* =========================================
   LEER ARDUINO
========================================= */

async function readArduino() {

    if (
        !port ||
        !port.readable
    ) {

        return;

    }


    const decoder =
        new TextDecoderStream();


    port.readable.pipeTo(
        decoder.writable
    ).catch(() => {});


    reader =
        decoder.readable.getReader();


    let buffer = "";


    try {

        while (true) {

            const {
                value,
                done
            } =
                await reader.read();


            if (done)
                break;


            buffer += value;


            const lines =
                buffer.split("\n");


            buffer =
                lines.pop();


            for (const line of lines) {

                const cleanLine =
                    line.trim();


                if (cleanLine !== "") {

                    processArduinoData(
                        cleanLine
                    );

                }

            }

        }

    }

    catch (error) {

        console.log(error);

    }

}


/* =========================================
   PROCESAR DATOS
========================================= */

function processArduinoData(line) {


    /* MOVIMIENTO */

    if (line.startsWith("MOV:")) {

        let value =
            Number(
                line.substring(4)
            );


        value =
            Math.max(
                0,
                Math.min(
                    100,
                    value
                )
            );


        movementValue.textContent =
            Math.round(value);


        movementMarker.style.left =
            value + "%";

    }


    /* PULSO */

    else if (
        line.startsWith("BPM:")
    ) {

        const value =
            Number(
                line.substring(4)
            );


        if (
            value > 0 &&
            value < 250
        ) {

            bpmValue.textContent =
                Math.round(value);

        }

    }


    /* BOTÓN FÍSICO */

    else if (
        line === "BUTTON"
    ) {

        if (
            ledBrightness > 0
        ) {

            sendCommand(
                "LED_OFF"
            );

            animateLED(
                0
            );

        }

        else {

            sendCommand(
                "RESET"
            );

            resetTimer();

        }

    }


    /* LED */

    else if (
        line.startsWith("LED:")
    ) {

        ledBrightness =
            Number(
                line.substring(4)
            );


        updateLED();

    }

}


/* =========================================
   ENVIAR COMANDO
========================================= */

function sendCommand(command) {

    if (!writer)
        return;


    writer.write(
        command + "\n"
    ).catch(() => {});

}


/* =========================================
   LED
========================================= */

function updateLED() {

    const intensity =
        ledBrightness / 255;


    ledIndicator.style.background =
        `rgb(
            0,
            ${Math.round(80 * intensity)},
            255
        )`;


    ledIndicator.style.boxShadow =
        `
        0 0
        ${5 + 40 * intensity}px
        rgba(
            0,
            150,
            255,
            ${0.1 + intensity * 0.7}
        )
        `;


    if (ledBrightness > 5) {

        ledState.textContent =
            "Encendido";

    }

    else {

        ledState.textContent =
            "Apagado";

    }

}


/* =========================================
   ANIMACIÓN LED
========================================= */

function animateLED(target) {

    const start =
        ledBrightness;


    const startTime =
        performance.now();


    function animation(time) {

        const progress =
            Math.min(
                1,
                (time - startTime) / 2000
            );


        ledBrightness =
            Math.round(
                start +
                (target - start)
                * progress
            );


        updateLED();


        if (progress < 1) {

            requestAnimationFrame(
                animation
            );

        }

    }


    requestAnimationFrame(
        animation
    );

}


/* =========================================
   GUARDAR TIEMPO
========================================= */

saveButton.addEventListener(
    "click",
    () => {

        const minutes =
            Math.max(
                0,
                Number(
                    minutesInput.value
                ) || 0
            );


        const seconds =
            Math.max(
                0,
                Math.min(
                    59,
                    Number(
                        secondsInput.value
                    ) || 0
                )
            );


        minutesInput.value =
            minutes;


        secondsInput.value =
            seconds;


        totalSeconds =
            minutes * 60 +
            seconds;


        remainingSeconds =
            totalSeconds;


        timerRunning = false;


        clearInterval(
            timerInterval
        );


        sendCommand(
            "SET:" +
            totalSeconds
        );


        updateTimer();

    }
);


/* =========================================
   INICIAR
========================================= */

startButton.addEventListener(
    "click",
    () => {

        if (!writer)
            return;


        if (remainingSeconds <= 0) {

            remainingSeconds =
                totalSeconds;

        }


        sendCommand(
            "START:" +
            remainingSeconds
        );


        startTimer();

    }
);


/* =========================================
   PAUSAR
========================================= */

pauseButton.addEventListener(
    "click",
    () => {

        if (!writer)
            return;


        pauseTimer();


        sendCommand(
            "PAUSE"
        );

    }
);


/* =========================================
   REINICIAR
========================================= */

resetButton.addEventListener(
    "click",
    () => {

        if (!writer)
            return;


        resetTimer();


        sendCommand(
            "RESET"
        );

    }
);


/* =========================================
   DESCONECTAR
========================================= */

disconnectButton.addEventListener(
    "click",
    async () => {

        try {

            if (reader) {

                await reader.cancel();

            }


            if (writer) {

                writer.releaseLock();

            }


            if (port) {

                await port.close();

            }

        }

        catch (error) {

            console.log(error);

        }


        port = null;

        reader = null;

        writer = null;


        connectButton.disabled =
            false;


        disconnectButton.disabled =
            true;


        saveButton.disabled =
            true;


        startButton.disabled =
            true;


        pauseButton.disabled =
            true;


        resetButton.disabled =
            true;


        setConnectionStatus(
            "Arduino desconectado",
            false
        );

    }
);


/* =========================================
   INICIO
========================================= */

updateTimer();

updateLED();
```
