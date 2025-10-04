import { describe, it, expect, beforeEach } from "vitest";
import { ClarityValue, uintCV, stringUtf8CV, buffCV, principalCV, noneCV, someCV, tupleCV, listCV, boolCV } from "@stacks/transactions";

const ERR_INVALID_STATE = 100;
const ERR_NOT_AUTHORIZED = 101;
const ERR_INVALID_TIME = 102;
const ERR_NOT_FOUND = 103;
const ERR_INVALID_THEME = 104;
const ERR_INVALID_PRIZE = 105;
const ERR_INVALID_JUDGES = 106;
const ERR_ALREADY_REGISTERED = 107;
const ERR_SUBMISSION_CLOSED = 108;
const ERR_VOTING_CLOSED = 109;
const ERR_INVALID_VOTE = 110;
const ERR_INVALID_SUBMISSION = 111;
const ERR_INVALID_PARTICIPANT = 112;
const ERR_PRIZE_DISTRIBUTED = 113;
const ERR_INSUFFICIENT_FUNDS = 114;
const ERR_INVALID_DURATION = 115;
const ERR_INVALID_CATEGORY = 116;
const ERR_MAX_SUBMISSIONS_EXCEEDED = 117;
const ERR_INVALID_ENTRY_FEE = 118;
const ERR_INVALID_REWARD_SPLIT = 119;
const ERR_INVALID_SPONSOR = 120;

const STATE_REGISTRATION = 0;
const STATE_SUBMISSION = 1;
const STATE_VOTING = 2;
const STATE_CLOSED = 3;

interface Participant {
  address: string;
  registeredAt: number;
}

interface Submission {
  participantId: number;
  hash: Uint8Array;
  description: string;
  timestamp: number;
  votes: number;
  category: string;
}

interface HackathonState {
  owner: string;
  currentState: number;
  startTime: number;
  submissionEnd: number;
  votingEnd: number;
  theme: string;
  prizePool: number;
  entryFee: number;
  maxSubmissions: number;
  rewardSplit: number;
  nextSubmissionId: number;
  nextParticipantId: number;
  participants: Map<number, Participant>;
  submissions: Map<number, Submission>;
  votes: Map<string, boolean>;
  judges: Set<string>;
  sponsors: Map<string, number>;
  categories: Set<string>;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class HackathonMock {
  state: HackathonState = {
    owner: "ST1OWNER",
    currentState: STATE_REGISTRATION,
    startTime: 0,
    submissionEnd: 0,
    votingEnd: 0,
    theme: "",
    prizePool: 0,
    entryFee: 0,
    maxSubmissions: 50,
    rewardSplit: 70,
    nextSubmissionId: 0,
    nextParticipantId: 0,
    participants: new Map(),
    submissions: new Map(),
    votes: new Map(),
    judges: new Set(),
    sponsors: new Set(),
    categories: new Set(),
  };
  blockHeight: number = 0;
  caller: string = "ST1CALLER";
  stxBalances: Map<string, number> = new Map([["contract", 0]]);
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      owner: "ST1OWNER",
      currentState: STATE_REGISTRATION,
      startTime: 0,
      submissionEnd: 0,
      votingEnd: 0,
      theme: "",
      prizePool: 0,
      entryFee: 0,
      maxSubmissions: 50,
      rewardSplit: 70,
      nextSubmissionId: 0,
      nextParticipantId: 0,
      participants: new Map(),
      submissions: new Map(),
      votes: new Map(),
      judges: new Set(),
      sponsors: new Map(),
      categories: new Set(),
    };
    this.blockHeight = 0;
    this.caller = "ST1CALLER";
    this.stxBalances.set("contract", 0);
    this.stxTransfers = [];
  }

  initialize(
    st: number,
    subEnd: number,
    votEnd: number,
    th: string,
    pr: number,
    fee: number,
    maxSub: number,
    split: number
  ): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.currentState !== STATE_REGISTRATION) return { ok: false, value: ERR_INVALID_STATE };
    if (st <= this.blockHeight) return { ok: false, value: ERR_INVALID_TIME };
    if (subEnd <= this.blockHeight) return { ok: false, value: ERR_INVALID_TIME };
    if (votEnd <= this.blockHeight) return { ok: false, value: ERR_INVALID_TIME };
    if (th.length === 0 || th.length > 100) return { ok: false, value: ERR_INVALID_THEME };
    if (pr <= 0) return { ok: false, value: ERR_INVALID_PRIZE };
    if (fee < 0) return { ok: false, value: ERR_INVALID_ENTRY_FEE };
    if (subEnd - st <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (votEnd - subEnd <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (split <= 0 || split > 100) return { ok: false, value: ERR_INVALID_REWARD_SPLIT };
    this.state.startTime = st;
    this.state.submissionEnd = subEnd;
    this.state.votingEnd = votEnd;
    this.state.theme = th;
    this.state.prizePool = pr;
    this.state.entryFee = fee;
    this.state.maxSubmissions = maxSub;
    this.state.rewardSplit = split;
    return { ok: true, value: true };
  }

  addJudge(judge: string): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (judge === this.caller) return { ok: false, value: ERR_INVALID_JUDGES };
    this.state.judges.add(judge);
    return { ok: true, value: true };
  }

  addCategory(cat: string): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.categories.add(cat);
    return { ok: true, value: true };
  }

  sponsorHackathon(amount: number): Result<boolean> {
    if (this.caller === this.state.owner) return { ok: false, value: ERR_INVALID_SPONSOR };
    this.stxTransfers.push({ amount, from: this.caller, to: "contract" });
    const current = this.state.sponsors.get(this.caller) || 0;
    this.state.sponsors.set(this.caller, current + amount);
    this.state.prizePool += amount;
    this.stxBalances.set("contract", (this.stxBalances.get("contract") || 0) + amount);
    return { ok: true, value: true };
  }

  registerParticipant(): Result<number> {
    if (this.state.currentState !== STATE_REGISTRATION) return { ok: false, value: ERR_INVALID_STATE };
    if (this.blockHeight >= this.state.startTime) return { ok: false, value: ERR_INVALID_TIME };
    for (const p of this.state.participants.values()) {
      if (p.address === this.caller) return { ok: false, value: ERR_ALREADY_REGISTERED };
    }
    if (this.state.entryFee > 0) {
      this.stxTransfers.push({ amount: this.state.entryFee, from: this.caller, to: "contract" });
      this.stxBalances.set("contract", (this.stxBalances.get("contract") || 0) + this.state.entryFee);
    }
    const id = this.state.nextParticipantId;
    this.state.participants.set(id, { address: this.caller, registeredAt: this.blockHeight });
    this.state.nextParticipantId++;
    return { ok: true, value: id };
  }

  submitProject(hash: Uint8Array, desc: string, cat: string): Result<number> {
    if (this.state.currentState !== STATE_SUBMISSION) return { ok: false, value: ERR_SUBMISSION_CLOSED };
    if (this.blockHeight < this.state.startTime || this.blockHeight >= this.state.submissionEnd) return { ok: false, value: ERR_INVALID_TIME };
    if (this.state.nextSubmissionId >= this.state.maxSubmissions) return { ok: false, value: ERR_MAX_SUBMISSIONS_EXCEEDED };
    let partId: number | undefined;
    for (const [id, p] of this.state.participants) {
      if (p.address === this.caller) {
        partId = id;
        break;
      }
    }
    if (partId === undefined) return { ok: false, value: ERR_INVALID_PARTICIPANT };
    if (!this.state.categories.has(cat) || desc.length === 0) return { ok: false, value: ERR_INVALID_SUBMISSION };
    const id = this.state.nextSubmissionId;
    this.state.submissions.set(id, { participantId: partId, hash, description: desc, timestamp: this.blockHeight, votes: 0, category: cat });
    this.state.nextSubmissionId++;
    return { ok: true, value: id };
  }

  voteOnSubmission(subId: number): Result<boolean> {
    if (this.state.currentState !== STATE_VOTING) return { ok: false, value: ERR_VOTING_CLOSED };
    if (this.blockHeight < this.state.submissionEnd || this.blockHeight >= this.state.votingEnd) return { ok: false, value: ERR_INVALID_TIME };
    if (!this.state.judges.has(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!this.state.submissions.has(subId)) return { ok: false, value: ERR_INVALID_VOTE };
    const voteKey = `${this.caller}-${subId}`;
    if (this.state.votes.has(voteKey)) return { ok: false, value: ERR_INVALID_VOTE };
    const sub = this.state.submissions.get(subId)!;
    this.state.submissions.set(subId, { ...sub, votes: sub.votes + 1 });
    this.state.votes.set(voteKey, true);
    return { ok: true, value: true };
  }

  closeHackathon(): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.blockHeight < this.state.votingEnd) return { ok: false, value: ERR_INVALID_TIME };
    this.state.currentState = STATE_CLOSED;
    return { ok: true, value: true };
  }

  distributePrizes(): Result<boolean> {
    if (this.state.currentState !== STATE_CLOSED) return { ok: false, value: ERR_INVALID_STATE };
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const topSubs: number[] = [];
    if (topSubs.length === 0) return { ok: false, value: ERR_NOT_FOUND };
    if (this.state.prizePool <= 0) return { ok: false, value: ERR_INSUFFICIENT_FUNDS };
    return { ok: true, value: true };
  }

  advanceState(): Result<number> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const state = this.state.currentState;
    if (state === STATE_REGISTRATION && this.blockHeight >= this.state.startTime) {
      this.state.currentState = STATE_SUBMISSION;
    } else if (state === STATE_SUBMISSION && this.blockHeight >= this.state.submissionEnd) {
      this.state.currentState = STATE_VOTING;
    } else if (state === STATE_VOTING && this.blockHeight >= this.state.votingEnd) {
      this.state.currentState = STATE_CLOSED;
    } else {
      return { ok: false, value: ERR_INVALID_TIME };
    }
    return { ok: true, value: this.state.currentState };
  }

  updatePrizePool(newPrize: number): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newPrize <= 0) return { ok: false, value: ERR_INVALID_PRIZE };
    this.state.prizePool = newPrize;
    return { ok: true, value: true };
  }

  updateEntryFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_ENTRY_FEE };
    this.state.entryFee = newFee;
    return { ok: true, value: true };
  }

  updateMaxSubmissions(newMax: number): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_PRIZE };
    this.state.maxSubmissions = newMax;
    return { ok: true, value: true };
  }

  updateRewardSplit(newSplit: number): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newSplit <= 0 || newSplit > 100) return { ok: false, value: ERR_INVALID_REWARD_SPLIT };
    this.state.rewardSplit = newSplit;
    return { ok: true, value: true };
  }

  withdrawFunds(amount: number): Result<boolean> {
    if (this.caller !== this.state.owner) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.currentState !== STATE_CLOSED) return { ok: false, value: ERR_INVALID_STATE };
    const balance = this.stxBalances.get("contract") || 0;
    if (amount > balance) return { ok: false, value: ERR_INSUFFICIENT_FUNDS };
    this.stxTransfers.push({ amount, from: "contract", to: this.state.owner });
    this.stxBalances.set("contract", balance - amount);
    return { ok: true, value: true };
  }
}

describe("Hackathon Contract", () => {
  let contract: HackathonMock;

  beforeEach(() => {
    contract = new HackathonMock();
    contract.reset();
  });

  it("initializes successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.initialize(10, 20, 30, "EdTech AI", 1000, 10, 50, 70);
    expect(result.ok).toBe(true);
    expect(contract.state.startTime).toBe(10);
    expect(contract.state.submissionEnd).toBe(20);
    expect(contract.state.votingEnd).toBe(30);
    expect(contract.state.theme).toBe("EdTech AI");
    expect(contract.state.prizePool).toBe(1000);
    expect(contract.state.entryFee).toBe(10);
    expect(contract.state.maxSubmissions).toBe(50);
    expect(contract.state.rewardSplit).toBe(70);
  });

  it("rejects initialization by non-owner", () => {
    const result = contract.initialize(10, 20, 30, "EdTech AI", 1000, 10, 50, 70);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("adds judge successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.addJudge("ST2JUDGE");
    expect(result.ok).toBe(true);
    expect(contract.state.judges.has("ST2JUDGE")).toBe(true);
  });

  it("adds category successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.addCategory("AI Learning");
    expect(result.ok).toBe(true);
    expect(contract.state.categories.has("AI Learning")).toBe(true);
  });

  it("sponsors hackathon successfully", () => {
    contract.caller = "ST3SPONSOR";
    const result = contract.sponsorHackathon(500);
    expect(result.ok).toBe(true);
    expect(contract.state.sponsors.get("ST3SPONSOR")).toBe(500);
    expect(contract.state.prizePool).toBe(500);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST3SPONSOR", to: "contract" }]);
  });

  it("registers participant successfully", () => {
    contract.caller = "ST1OWNER";
    contract.initialize(10, 20, 30, "EdTech AI", 1000, 10, 50, 70);
    contract.caller = "ST4PART";
    contract.blockHeight = 5;
    const result = contract.registerParticipant();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const part = contract.state.participants.get(0);
    expect(part?.address).toBe("ST4PART");
    expect(contract.stxTransfers).toEqual([{ amount: 10, from: "ST4PART", to: "contract" }]);
  });

  it("submits project successfully", () => {
    contract.caller = "ST1OWNER";
    contract.initialize(10, 20, 30, "EdTech AI", 1000, 0, 50, 70);
    contract.addCategory("AI Learning");
    contract.caller = "ST4PART";
    contract.blockHeight = 5;
    contract.registerParticipant();
    contract.blockHeight = 15;
    contract.state.currentState = STATE_SUBMISSION;
    const hash = new Uint8Array([1, 2, 3]);
    const result = contract.submitProject(hash, "Project Desc", "AI Learning");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const sub = contract.state.submissions.get(0);
    expect(sub?.description).toBe("Project Desc");
    expect(sub?.category).toBe("AI Learning");
  });

  it("votes on submission successfully", () => {
    contract.caller = "ST1OWNER";
    contract.initialize(10, 20, 30, "EdTech AI", 1000, 0, 50, 70);
    contract.addJudge("ST2JUDGE");
    contract.addCategory("AI Learning");
    contract.caller = "ST4PART";
    contract.blockHeight = 5;
    contract.registerParticipant();
    contract.blockHeight = 15;
    contract.state.currentState = STATE_SUBMISSION;
    const hash = new Uint8Array([1, 2, 3]);
    contract.submitProject(hash, "Project Desc", "AI Learning");
    contract.blockHeight = 25;
    contract.state.currentState = STATE_VOTING;
    contract.caller = "ST2JUDGE";
    const result = contract.voteOnSubmission(0);
    expect(result.ok).toBe(true);
    const sub = contract.state.submissions.get(0);
    expect(sub?.votes).toBe(1);
  });

  it("closes hackathon successfully", () => {
    contract.caller = "ST1OWNER";
    contract.initialize(10, 20, 30, "EdTech AI", 1000, 0, 50, 70);
    contract.blockHeight = 35;
    const result = contract.closeHackathon();
    expect(result.ok).toBe(true);
    expect(contract.state.currentState).toBe(STATE_CLOSED);
  });

  it("advances state successfully", () => {
    contract.caller = "ST1OWNER";
    contract.initialize(10, 20, 30, "EdTech AI", 1000, 0, 50, 70);
    contract.blockHeight = 15;
    const result1 = contract.advanceState();
    expect(result1.ok).toBe(true);
    expect(result1.value).toBe(STATE_SUBMISSION);
    contract.blockHeight = 25;
    const result2 = contract.advanceState();
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(STATE_VOTING);
    contract.blockHeight = 35;
    const result3 = contract.advanceState();
    expect(result3.ok).toBe(true);
    expect(result3.value).toBe(STATE_CLOSED);
  });

  it("updates prize pool successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.updatePrizePool(2000);
    expect(result.ok).toBe(true);
    expect(contract.state.prizePool).toBe(2000);
  });

  it("updates entry fee successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.updateEntryFee(20);
    expect(result.ok).toBe(true);
    expect(contract.state.entryFee).toBe(20);
  });

  it("updates max submissions successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.updateMaxSubmissions(100);
    expect(result.ok).toBe(true);
    expect(contract.state.maxSubmissions).toBe(100);
  });

  it("updates reward split successfully", () => {
    contract.caller = "ST1OWNER";
    const result = contract.updateRewardSplit(80);
    expect(result.ok).toBe(true);
    expect(contract.state.rewardSplit).toBe(80);
  });

  it("withdraws funds successfully", () => {
    contract.caller = "ST1OWNER";
    contract.initialize(10, 20, 30, "EdTech AI", 1000, 0, 50, 70);
    contract.state.currentState = STATE_CLOSED;
    contract.stxBalances.set("contract", 500);
    const result = contract.withdrawFunds(300);
    expect(result.ok).toBe(true);
    expect(contract.stxBalances.get("contract")).toBe(200);
    expect(contract.stxTransfers).toEqual([{ amount: 300, from: "contract", to: "ST1OWNER" }]);
  });
});