"use strict";

// The audioContext is global scoped and only created once
var audioCtx = new AudioContext();

function FlightLogAnalyser(flightLog, graphConfig, canvas, analyserCanvas, options) {

var
        ANALYSER_LEFT_PROPORTION    = parseInt(userSettings.analyser.left) / 100.0, // 5% from left
        ANALYSER_TOP_PROPORTION     = parseInt(userSettings.analyser.top) / 100.0, // 55% from top
        ANALYSER_HEIGHT_PROPORTION  = parseInt(userSettings.analyser.size) / 100.0, // 40% high
        ANALYSER_WIDTH_PROPORTION   = parseInt(userSettings.analyser.size) / 100.0, // 40% wide

        ANALYSER_LARGE_LEFT_PROPORTION    = 0.05, // 5% from left
        ANALYSER_LARGE_TOP_PROPORTION     = 0.05, // 55% from top
        ANALYSER_LARGE_HEIGHT_PROPORTION  = 0.90, // 40% high
        ANALYSER_LARGE_WIDTH_PROPORTION   = 0.90; // 40% wide

var canvasCtx = analyserCanvas.getContext("2d");

var // inefficient; copied from grapher.js

        DEFAULT_FONT_FACE = "Verdana, Arial, sans-serif",
        
        drawingParams = {
            fontSizeFrameLabel: null
        };

var that = this;
	  
var AudioContext = window.AudioContext || window.webkitAudioContext;
try {
	var frameCount = 4096;
//	var audioCtx = new AudioContext();
	var audioBuffer   	= audioCtx.createBuffer(1, frameCount, audioCtx.sampleRate);
	var source        	= audioCtx.createBufferSource();
		source.buffer 	= audioBuffer; 
		source.loop	  	= true;
		source.start();

	var spectrumAnalyser = audioCtx.createAnalyser();	  
		spectrumAnalyser.fftSize = 256;
		spectrumAnalyser.smoothingTimeConstant = 0.8;
		spectrumAnalyser.minDecibels = -100;
		spectrumAnalyser.maxDecibels = -30;    

	var dataBuffer = {
			chunks: 0, 
			startFrameIndex: 0, 
			fieldIndex: 0, 
			curve: 0,
			windowCenterTime: 0, 
			windowEndTime: 0
		};

	var initialised = false;
	var analyserFieldName;   // Name of the field being analysed
	var analyserSampleRange; // Start and Endtime of sampling as string

	// Setup the audio path
	source.connect(spectrumAnalyser);

	var audioIterations = 0; // variable to monitor spectrum processing

	var isFullscreen = false;

	this.setFullscreen = function(size) {
		isFullscreen = (size==true);
		that.resize();
	}

	function getSize() {
		if (isFullscreen){
				return {
					height: ANALYSER_LARGE_HEIGHT_PROPORTION,
					width: ANALYSER_LARGE_WIDTH_PROPORTION,
					left: ANALYSER_LARGE_LEFT_PROPORTION,
					top: ANALYSER_LARGE_TOP_PROPORTION,
					}
			} else {
				return {
					height: parseInt(userSettings.analyser.size) / 100.0,
					width: parseInt(userSettings.analyser.size) / 100.0,
					left: parseInt(userSettings.analyser.left) / 100.0,
					top: parseInt(userSettings.analyser.top) / 100.0,
				}
			}
			
	}

   	this.resize = function() {

        // Determine the analyserCanvas location
        canvasCtx.canvas.height    = (canvas.height * getSize().height);
        canvasCtx.canvas.width     = (canvas.width  * getSize().width);

		// Recenter the analyser canvas in the bottom left corner
		$(analyserCanvas).css({
			left: (canvas.width  * getSize().left) + "px",
			top:  (canvas.height * getSize().top ) + "px",
		});

	}

	function dataLoad(dataBuffer, audioBuffer) {

			var chunkIndex, frameIndex;
			var i = 0;            

			var startTime = null; // Debugging variables
			var endTime   = null;

			var audioBufferData = audioBuffer.getChannelData(0); // link to the first channel

			//We may start partway through the first chunk:
			frameIndex = dataBuffer.startFrameIndex;

			dataCollectionLoop:
			for (chunkIndex = 0; chunkIndex < dataBuffer.chunks.length; chunkIndex++) {
				var chunk = dataBuffer.chunks[chunkIndex];
				for (; frameIndex < chunk.frames.length; frameIndex++) {
					var fieldValue = chunk.frames[frameIndex][dataBuffer.fieldIndex];
					var frameTime  = chunk.frames[frameIndex][FlightLogParser.prototype.FLIGHT_LOG_FIELD_INDEX_TIME]
					if(frameTime >= dataBuffer.windowCenterTime) {
						if(startTime === null) startTime = formatTime((frameTime - flightLog.getMinTime())/1000, true);
						
						audioBufferData[i++] = (dataBuffer.curve.lookupRaw(fieldValue));

						if (i >= audioBuffer.length || frameTime >= dataBuffer.windowEndTime) {
							endTime = formatTime((frameTime - flightLog.getMinTime())/1000, true);
							analyserSampleRange = '(' + startTime + ' to ' + endTime + ')';
							//console.log("Samples : " + i + analyserSampleRange);
							break dataCollectionLoop;
							}
						}
				}
				frameIndex = 0;
			}
			audioIterations++;
	}

	/* Function to actually draw the spectrum analyser overlay
		again, need to look at optimisation.... 

		*/

	function draw() {

		  canvasCtx.save();

		  canvasCtx.lineWidth = 1;
		  
		  var bufferLength = spectrumAnalyser.frequencyBinCount;
		  var dataArray = new Uint8Array(bufferLength);



		  canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);

		  var MARGIN = 10; // pixels
		  var HEIGHT = canvasCtx.canvas.height - MARGIN;
		  var WIDTH  = canvasCtx.canvas.width;
		  var LEFT   = canvasCtx.canvas.left;
		  var TOP    = canvasCtx.canvas.top;

		  /* only plot the lower half of the FFT, as the top half
		  never seems to have any values in it - too high frequency perhaps. */
		  var PLOTTED_BUFFER_LENGTH = bufferLength; // / 2;

		  canvasCtx.translate(LEFT, TOP);

		  spectrumAnalyser.getByteFrequencyData(dataArray);

		  var gradient = canvasCtx.createLinearGradient(0,0,0,(HEIGHT));
    		  gradient.addColorStop(1,   'rgba(255,255,255,0.25)');
			  gradient.addColorStop(0,   'rgba(255,255,255,0)');
		  canvasCtx.fillStyle = gradient; //'rgba(255, 255, 255, .25)'; /* white */
		  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

		  var barWidth = (WIDTH / PLOTTED_BUFFER_LENGTH) - 1;// * 2.5;
		  var barHeight;
		  var x = 0;

		  var gradient = canvasCtx.createLinearGradient(0,HEIGHT,0,0);
    		  gradient.addColorStop(0,   'rgba(0,255,0,0.2)');
    		  gradient.addColorStop(0.15, 'rgba(128,255,0,0.2)');
			  gradient.addColorStop(0.45, 'rgba(255,0,0,0.5)');
			  gradient.addColorStop(1,   'rgba(255,128,128,1.0)');

		  for(var i = 0; i < (PLOTTED_BUFFER_LENGTH); i++) {
		  barHeight = (dataArray[i]/255 * (HEIGHT));

			canvasCtx.fillStyle = gradient; //'rgba(0,255,0,0.3)'; /* green */
			canvasCtx.fillRect(x,(HEIGHT)-barHeight,barWidth,barHeight);

			x += barWidth + 1;
		  }
		  drawAxisLabel(analyserFieldName + ' ' + analyserSampleRange, WIDTH - 4, HEIGHT - 6, 'right');
		  drawGridLines(options.analyserSampleRate, LEFT, TOP, WIDTH, HEIGHT, MARGIN);
		  
		  var offset = 0;
		  if(flightLog.getSysConfig().gyro_lowpass_hz!=null) drawMarkerLine(flightLog.getSysConfig().gyro_lowpass_hz/100.0,  options.analyserSampleRate, 'GYRO Filter ', WIDTH, HEIGHT, (15*offset++) + MARGIN)
		  if(flightLog.getSysConfig().dterm_lpf_hz!=null)    drawMarkerLine(flightLog.getSysConfig().dterm_lpf_hz/100.0,  options.analyserSampleRate, 'D-TERM Filter', WIDTH, HEIGHT, (15*offset++) + MARGIN)
		  if(flightLog.getSysConfig().yaw_lpf_hz!=null)      drawMarkerLine(flightLog.getSysConfig().yaw_lpf_hz/100.0,  options.analyserSampleRate, 'YAW Filter', WIDTH, HEIGHT, (15*offset++) + MARGIN)
		  
		  canvasCtx.restore();
		}
	
	function drawMarkerLine(frequency, sampleRate, label, WIDTH, HEIGHT, OFFSET){
		var x = WIDTH * frequency / (sampleRate / 2); // percentage of range where frequncy lies

		canvasCtx.beginPath();
		canvasCtx.lineWidth = 1;
		canvasCtx.strokeStyle = "rgba(128,128,255,0.50)";

		canvasCtx.moveTo(x, 0);
		canvasCtx.lineTo(x, HEIGHT);

		canvasCtx.stroke();
		
		drawAxisLabel(label + ' ' + (frequency.toFixed(0))+"Hz", (x + 2), OFFSET, 'left');
		
	}

	function drawGridLines(sampleRate, LEFT, TOP, WIDTH, HEIGHT, MARGIN) {

		var ticks = 5;
		var frequencyInterval = (sampleRate / ticks) / 2;
		var frequency = 0;

		for(var i=0; i<=ticks; i++) {
				canvasCtx.beginPath();
				canvasCtx.lineWidth = 1;
				canvasCtx.strokeStyle = "rgba(255,255,255,0.25)";

				canvasCtx.moveTo(i * (WIDTH / ticks), 0);
				canvasCtx.lineTo(i * (WIDTH / ticks), HEIGHT);

				canvasCtx.stroke();
				var textAlign = (i==0)?'left':((i==ticks)?'right':'center');
				drawAxisLabel((frequency.toFixed(0))+"Hz", i * (WIDTH / ticks), HEIGHT + MARGIN, textAlign);
				frequency += frequencyInterval;
		}	
	}

	function drawAxisLabel(axisLabel, X, Y, align) {
			canvasCtx.font = drawingParams.fontSizeFrameLabel + "pt " + DEFAULT_FONT_FACE;
			canvasCtx.fillStyle = "rgba(255,255,255,0.9)";
			if(align) {
				 canvasCtx.textAlign = align;
				 } else 
				 {
				 canvasCtx.textAlign = 'center';
				 }


			canvasCtx.fillText(axisLabel, X, Y);
		}

	/* This function is called from the canvas drawing routines within grapher.js
	   It is only used to record the current curve positions, collect the data and draw the 
	   analyser on screen*/

	this.plotSpectrum =	function (chunks, startFrameIndex, fieldIndex, curve, fieldName, windowCenterTime, windowEndTime) {
			// Store the data pointers
			dataBuffer = {
				chunks: chunks,
				startFrameIndex: startFrameIndex,
				fieldIndex: fieldIndex,
				curve: curve,
				windowCenterTime: windowCenterTime,
				windowEndTime: windowEndTime
			};

			analyserFieldName = fieldName;

			if (audioBuffer) {
				dataLoad(dataBuffer, audioBuffer);
			}
			draw(); // draw the analyser on the canvas....
	}
	} catch (e) {
		console.log('Failed to create analyser... error:' + e);
	};

	// release the hardware context associated with the analyser
	this.closeAnalyserHardware = function() {
		try {
			if(audioCtx!=null) audioCtx.close();
		} catch(e) {
			console.log('Failed to close analyser... error:' + e);
		}
	}

}