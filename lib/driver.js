"use strict";

var buffy = require("buffy"),
    Cylon = require("cylon");

var INIT_CODE, MODE_00, BT_SYNC, CODE_EX, CODE_SIGNAL_QUALITY, CODE_ATTENTION,
    CODE_MEDITATION, CODE_BLINK, CODE_WAVE, CODE_ASIC_EEG, CODE_8BIT_RAW;

var Driver = module.exports = function Driver() {
  Driver.__super__.constructor.apply(this, arguments);

  this.commands = {
    read: this.read
  };

  this.events = [
    /**
    * Emitted whenever the Mindflex is in mode 0x00, i.e. 9600 baud without raw output
    *
    * @event mode 0x00 reference bytes
    */
    "mode00",
      
    /**
     * Emitted whenever the Mindflex serialport sends data
     *
     * @event data
     * @value data direct data from serialport
     */
    "data",

    /**
     * Emitted whenever a Mindflex raw packet is parsed
     *
     * @event rawPacket
     * @value parsed raw packet
     */
    "rawPacket",

    /**
     * Emitted whenever a Mindflex computed packet is parsed. An all computed packet contains attention, meditation and eeg per-spectrum data
     *
     * @event allComputedPacket
     * @value parsed all computed packet
     */
    "allComputedPacket",

    /**
     * Emitted whenever a Mindflex computed packet is parsed. A meditation computed packet contains meditation and eeg per-spectrum data
     *
     * @event meditationComputedPacket
     * @value parsed meditation computed packet
     */
    "meditationComputedPacket",

    /**
     * Emitted whenever a Mindflex computed packet is parsed. An attention computed packet contains attention and eeg per-spectrum data
     *
     * @event attentionComputedPacket
     * @value parsed attention computed packet
     */
     "attentionComputedPacket",

    /**
    * Emitted whenever a Mindflex packet checksum doesn't equal to the received one
    *
    * @event badPacket
    * @value packet
    */
    "badPacket",

    /**
     * Emitted whenever the extended code is found in a Mindflex packet
     *
     * @event extended
     */
    "extended",

    /**
     * Emitted when packets are received, as an indicator of poor signal quality
     *
     * @event signal
     * @value quality 0-255
     */
    "signal",

    /**
     * Emitted when the Attention code is detected in a packet
     *
     * @event attention
     * @value value 0-100
     */
    "attention",

    /**
     * Emitted when the Meditation code is detected in a packet
     *
     * @event meditation
     * @value value 0-100
     */
    "meditation",

    /**
     * Emitted with the packet's provided blink strength
     *
     * @event blink
     * @value value 0-255
     */
    "blink",

    /**
     * Emitted per packet, contains raw EEG wave value
     *
     * @event wave
     * @value value 2-byte big-endian 2s-complement
     */
    "wave",

    /**
     * Emitted with processed EEG data per-packet.
     *
     * @event eeg
     * @value eeg an object containing EEG info (delta, theta, etc wave states)
     */
    "eeg"
  ];

  this.mainBuffer = new Buffer(0);
};

Cylon.Utils.subclass(Driver, Cylon.Driver);

Driver.prototype.start = function(callback) {
  this.once("mode00", function() {
    this.connection.write(INIT_CODE);
  });

  this.on("data", function(data) {
    this.mainBuffer = Buffer.concat([this.mainBuffer, data]);
    var parsedBytes = this.parse();
    this.mainBuffer = this.mainBuffer.slice(parsedBytes, this.mainBuffer.length);
  });

  this.connection.read(function(data) {
    this.emit("data", data);
  }.bind(this));
  callback();
};

Driver.prototype.halt = function(callback) {
  callback();
};

/**
 * Reads data from the Neurosky serialport.
 *
 * Triggers the callback with any new data
 *
 * @param {Function} callback to be triggered when new data is available
 * @return {void}
 * @publish
 */
Driver.prototype.read = function(callback) {
  return this.connection.read(callback);
};

/**
 * Parses data from the Mindflex
 *
 * @return {Object} parsed bytes
 * @publish
 */
Driver.prototype.parse = function() {
  var parsedBytes = 0;

  while (this.mainBuffer.length - parsedBytes >= 3) {
    if (this.mainBuffer.readUInt8(parsedBytes) === MODE_00 && this.mainBuffer.readUInt8(parsedBytes + 1) === MODE_00) {
      parsedBytes += 2;
      this.emit("mode00");
      return parsedBytes;
    }

    if (this.mainBuffer.readUInt8(parsedBytes) === BT_SYNC) {
      if (this.mainBuffer.readUInt8(parsedBytes + 1) === BT_SYNC) {
        var len = this.mainBuffer.readUInt8(parsedBytes + 2);
        if (this.mainBuffer.length - ( parsedBytes + 3) >= len + 1) {
          parsedBytes += 3;
          var payload = this.mainBuffer.slice(parsedBytes, parsedBytes + len);
          var checksum = this.mainBuffer.readUInt8(parsedBytes + len);
          var computedChecksum = this.computeChecksum(payload);
          if (computedChecksum !== checksum) {
            this.emit("badPacket", computedChecksum & checksum);
            return parsedBytes + len + 1;
          }
          var packet = this.parsePacket(payload);
          parsedBytes += len + 1;
          if (packet.hasOwnProperty("wave")) {
            this.emit("rawPacket", packet);
          } else {
            if (!packet.hasOwnProperty("attention") && packet.hasOwnProperty("meditation")) {
              this.emit("meditationComputedPacket", packet);
            } else if (packet.hasOwnProperty("attention") && !packet.hasOwnProperty("meditation")) {
              this.emit("attentionComputedPacket", packet);
            } else if (packet.hasOwnProperty("attention") && packet.hasOwnProperty("meditation")) {
              this.emit("allComputedPacket", packet);
            }
          }
        } else {
          return parsedBytes;
        }
      }
    } else {
      parsedBytes++;
    }
  }

  return parsedBytes;
};

/**
 * Compute payload checksum
 *
 * @param {Object} data whose checksum must be computed
 * @return {Object} Computed checksum
 * @publish
 */
Driver.prototype.computeChecksum = function(data) {
  var computedChecksum = 0;

  for (var i=0; i < data.byteLength; i++) {
    computedChecksum += data[i];
  }

  //taking the lowest 8 bits
  computedChecksum &= 0xFF;
  //bit inversion
  computedChecksum = ~computedChecksum;
  //taking again the lowest 8 bits
  computedChecksum &= 0xFF;

  return computedChecksum;
};

/**
 * Parses a packet of data from the Mindflex
 *
 * @param {Object} data packet to be parsed
 * @return {Object} parsed packet
 * @publish
 */
Driver.prototype.parsePacket = function(data) {
  var parsedBytes = 0;
  var timestamp = new Date();
  var packet = {
        timestamp: timestamp,
        extended: 0
      };

  while (data.length - parsedBytes > 0) {
    switch (data.readUInt8(parsedBytes)) {
      case CODE_EX:
        parsedBytes++;
        packet.extended++;
        break;

      case CODE_SIGNAL_QUALITY:
        parsedBytes++;
        packet.signal = data.readUInt8(parsedBytes);
        parsedBytes++;
        break;

      case CODE_ATTENTION:
        parsedBytes++;
        packet.attention = data.readUInt8(parsedBytes);
        parsedBytes++;
        break;

      case CODE_MEDITATION:
        parsedBytes++;
        packet.meditation = data.readUInt8(parsedBytes);
        parsedBytes++;
        break;

      case CODE_BLINK:
        parsedBytes++;
        packet.blink = data.readUInt8(parsedBytes);
        parsedBytes++;
        break;

      case CODE_WAVE:
        //One additional byte has to be skipped
        parsedBytes += 2;
        packet.wave = data.readInt16BE(parsedBytes);
        parsedBytes += 2;
        break;

      case CODE_8BIT_RAW:
        parsedBytes++;
        packet.bit_raw = data.readUInt8(parsedBytes);
        parsedBytes++;
        break;

      case CODE_ASIC_EEG:
        parsedBytes++;
        packet.eeg = this.parseEEG(data.slice(parsedBytes, parsedBytes + 24));
        parsedBytes += 24;
        break;

      default:
        parsedBytes++;
    }
  }

  return packet;
};

/**
 * Parses data from a Mindflex packet to get current EEG state
 *
 * @param {Object} data packet content to be parsed
 * @return {Object} eeg data
 * @publish
 */
Driver.prototype.parseEEG = function(data) {
  return {
    delta: this.parse3ByteInteger(data.slice(0, 2)),
    theta: this.parse3ByteInteger(data.slice(3, 5)),
    loAlpha: this.parse3ByteInteger(data.slice(6, 8)),
    hiAlpha: this.parse3ByteInteger(data.slice(9, 11)),
    loBeta: this.parse3ByteInteger(data.slice(12, 14)),
    hiBeta: this.parse3ByteInteger(data.slice(15, 17)),
    loGamma: this.parse3ByteInteger(data.slice(18, 20)),
    midGamma: this.parse3ByteInteger(data.slice(21, 24))
  };
};

Driver.prototype.parse3ByteInteger = function(data) {
  return (data[0] << 16) |
         (((1 << 16) - 1) & (data[1] << 8)) |
         ((1 << 8) - 1) &
         data[2];
};

MODE_00 = 0xE0;                                // Mode 0x00 reference byte https://github.com/slaporte/brain/blob/master/mindflex.py
BT_SYNC = 0xAA;                                // Sync packet
CODE_EX = 0x55;                                // Extended code
CODE_SIGNAL_QUALITY = 0x02;                    // POOR_SIGNAL quality 0-255
CODE_ATTENTION = 0x04;                         // ATTENTION eSense 0-100
CODE_MEDITATION = 0x05;                        // MEDITATION eSense 0-100
CODE_8BIT_RAW = 0x06;
CODE_BLINK = 0x16;                             // BLINK strength 0-255
CODE_WAVE = 0x80;                              // RAW wave value: 2-byte big-endian 2s-complement
CODE_ASIC_EEG = 0x83;                          // ASIC EEG POWER 8 3-byte big-endian integers
INIT_CODE = new Buffer("00F8000000E0", "hex"); //Init code to send at 57600 baud to switch the Mindflex from mode 0x00 to mode 0x02
                                               // http://www.instructables.com/id/Mindflex-EEG-with-raw-data-over-Bluetooth/
