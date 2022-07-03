//import { SmartCardException } from './errors.ts';
import { BytesLike, HEX, toUint8Array } from '../buffer-utils.ts';

export class SmartCardException extends Error {
}

/**
 * ISO7816 Command APDU
 */
export class CommandAPDU {
  data?: Uint8Array;
  isExtended: boolean;
  description: string;

  constructor(
    public cla: number,
    public ins: number,
    public p1: number,
    public p2: number,
    data?: BytesLike,
    public le?: number,
    isExtended = false,
    options?: { description?: string }
  ) {
    if (data !== undefined) {
      this.data = toUint8Array(data);
    }

    this.isExtended = isExtended ?? false;

    this.description = options?.description ?? "";
  }

  public toString(): string {
    let s = "CommandAPDU ";
    s += "CLA=0x" + HEX.toString([this.cla]);
    s += "," + "INS=0x" + HEX.toString([this.ins]);
    s += "," + "P1=0x" + HEX.toString([this.p1]);
    s += "," + "P1=0x" + HEX.toString([this.p2]);
    if (this.data && this.data.length) {
      s += "," + "LC=" + this.Lc;
      s += "," + "DATA=" + HEX.toString(this.data);
    }
    if (this.le) {
      s += "," + "LE=" + this.le;
    }

    if (this.description) {
      s += " (" + this.description + ")";
    }

    return s;
  }

  public get Lc(): number {
    return this.data?.length ?? 0;
  }
  public get header(): Uint8Array {
    return new Uint8Array([this.cla, this.ins, this.p1, this.p2]);
  }

  /**
   * Fluent Builder
   */
  public static init(
    cla = 0x00,
    ins = 0x00,
    p1 = 0x00,
    p2 = 0x00,
    data?: Uint8Array,
  ): CommandAPDU {
    return (new CommandAPDU(cla, ins, p1, p2, data));
  }

  public setCLA(cla: number): this {
    this.cla = cla;
    return this;
  }
  public setINS(ins: number): this {
    this.ins = ins;
    return this;
  }
  public setP1(p1: number): this {
    this.p1 = p1;
    return this;
  }
  public setP2(p2: number): this {
    this.p2 = p2;
    return this;
  }
  public setData(data: BytesLike): this {
    this.data = toUint8Array(data);
    return this;
  }
  public setLe(Le: number): this {
    this.le = Le;
    return this;
  }
  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Encode
   */
  public toBytes(options?: { protocol?: number}): Uint8Array {
    const isT0 = (options?.protocol ?? 1) == 0;
    const lc = this.data?.length ?? 0;
    const isExtended = (this.isExtended ?? false) && !isT0;
    const le = (lc == 0 || !isT0) ? (this.le ?? 0) : 0;

    const len = 4 +
      ((lc == 0) ? 0 : (isExtended ? 3 : 1)) +
      lc +
      ((le == 0) ? 0 : (isExtended ? 3 : 1));

    const raw = new Uint8Array(len);

    let off = 0;
    raw.set([this.cla, this.ins, this.p1, this.p2], 0);
    off += 4;

    if (lc > 0) {
      raw.set(isExtended ? [0x00, lc >> 8, lc & 0xff] : [lc], off);
      off += isExtended ? 3 : 1;

      raw.set(this.data!, off);
      off += lc;
    }

    if (le > 0) {
      raw.set(isExtended ? [0x00, le >> 8, le & 0xff] : [le], off);
      off += isExtended ? 3 : 1;
    }
    return raw;
  }

  /**
   * Decode
   */
  static from(bytes: BytesLike, options?: { description?: string } ): CommandAPDU {
    const buffer = toUint8Array(bytes);

    if (buffer.length < 4) {
      throw new Error("CommandAPDU: Invalid buffer");
    }

    const [cla, ins, p1, p2, ...rest] = buffer;
    let data;
    let le;
    const isExtended = false;

    let offset = 4;

    if (rest.length > 1) {
      let lc;

      [lc, ...data] = rest;

      data = data.slice(0, lc);

      offset += 1 + lc;
    }

    if (buffer.length > offset) {
      le = buffer[offset++];
    }

    const apdu = new CommandAPDU( cla, ins, p1, p2, data, le, isExtended, options);

    if (buffer.length != offset) {
      throw new SmartCardException("CommandAPDU: Invalid buffer");
    }

    return apdu;
  }
}

/**
 * ISO7816 Response APDU
 */
export class ResponseAPDU {
  SW = 0;
  data: Uint8Array;
  description = "";

  /**
   * @constructor
   *
   * Deserialize from a JSON object
   */
  constructor(bytes: BytesLike = [], options?: {description?: string} ) {
    const buffer = toUint8Array(bytes);

    if (buffer.length < 2) {
      throw new SmartCardException("ResponseAPDU Buffer invalid");
    }

    const la = buffer.length - 2;

    this.SW = new DataView(buffer.buffer).getUint16(la);
    this.data = buffer.slice(0, la);

    this.description = options?.description ?? "";
  }

  public toString(): string {
    let s = "ResponseAPDU ";
    s += "SW=0x" + HEX.toString([this.SW >> 8, this.SW & 0xff], false);
    if (this.data && this.data.length) {
      s += "," + "La=" + this.La;
      s += "," + "Data=" + HEX.toString(this.data);
    }
    if (this.description) {
      s += " (" + this.description + ")";
    }

    return s;
  }

  public get La() {
    return this.data.length;
  }

  public static init(SW = 0x0000, data: BytesLike = []): ResponseAPDU {
    return (new ResponseAPDU()).set(SW, data);
  }

  public set(sw: number, data: BytesLike): this {
    this.SW = sw;
    this.data = toUint8Array(data);

    return this;
  }

  public setSW(SW: number): this {
    this.SW = SW;
    return this;
  }
  public setSW1(SW1: number): this {
    this.SW = (this.SW & 0xFF) | (SW1 << 8);
    return this;
  }
  public setSW2(SW2: number): this {
    this.SW = (this.SW & 0xFF00) | SW2;
    return this;
  }
  public setData(data: BytesLike): this {
    this.data = toUint8Array(data);
    return this;
  }
  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Encoder function, returns a blob from an APDUResponse object
   */
  public toBytes(_options?: unknown): Uint8Array {
    const bytes = new Uint8Array(this.La + 2);

    bytes.set(this.data, 0);
    bytes[this.La] = (this.SW >> 8) & 0xff;
    bytes[this.La + 1] = (this.SW >> 0) & 0xff;

    return bytes;
  }

  public static from(SW: number, data?: BytesLike, options?: {description?: string}): ResponseAPDU {
    const buffer = toUint8Array(data);

    return new ResponseAPDU([...buffer, SW >> 8, SW & 0xff], options);
  }
}
