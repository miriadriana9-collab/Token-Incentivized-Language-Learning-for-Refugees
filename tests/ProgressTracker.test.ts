import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, buffCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_COURSE_ID = 101;
const ERR_INVALID_MILESTONE_ID = 102;
const ERR_INVALID_PROGRESS_HASH = 103;
const ERR_INVALID_VERIFICATION = 104;
const ERR_PROGRESS_ALREADY_EXISTS = 105;
const ERR_PROGRESS_NOT_FOUND = 106;
const ERR_INVALID_TIMESTAMP = 107;
const ERR_USER_NOT_REGISTERED = 108;
const ERR_INVALID_PROOF = 109;
const ERR_MAX_PROGRESSES_EXCEEDED = 110;
const ERR_INVALID_REWARD_THRESHOLD = 111;
const ERR_INVALID_UPDATE = 112;
const ERR_INVALID_STATUS = 113;
const ERR_INVALID_LEVEL = 114;
const ERR_INVALID_DIFFICULTY = 115;
const ERR_INVALID_EXPIRY = 116;
const ERR_INVALID_SCORE = 117;
const ERR_INVALID_ATTEMPTS = 118;
const ERR_INVALID_COMPLETION_RATE = 119;
const ERR_INVALID_VERIFIER = 120;

interface Progress {
  progressHash: Uint8Array;
  milestoneId: number;
  timestamp: number;
  verified: boolean;
  score: number;
  attempts: number;
  level: number;
  difficulty: number;
  expiry: number;
  status: boolean;
}

interface ProgressWithUser extends Progress {
  user: string;
  courseId: number;
}

interface ProgressUpdate {
  updateHash: Uint8Array;
  updateMilestone: number;
  updateTimestamp: number;
  updater: string;
  updateScore: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ProgressTrackerMock {
  state: {
    nextProgressId: number;
    maxProgresses: number;
    verificationFee: number;
    rewardThreshold: number;
    authorityContract: string | null;
    userProgress: Map<string, Map<number, Progress>>;
    progressById: Map<number, ProgressWithUser>;
    progressUpdates: Map<number, ProgressUpdate>;
  } = {
    nextProgressId: 0,
    maxProgresses: 10000,
    verificationFee: 500,
    rewardThreshold: 80,
    authorityContract: null,
    userProgress: new Map(),
    progressById: new Map(),
    progressUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProgressId: 0,
      maxProgresses: 10000,
      verificationFee: 500,
      rewardThreshold: 80,
      authorityContract: null,
      userProgress: new Map(),
      progressById: new Map(),
      progressUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setVerificationFee(newFee: number): Result<boolean> {
    if (this.state.authorityContract === null) return { ok: false, value: false };
    if (newFee < 0) return { ok: false, value: false };
    this.state.verificationFee = newFee;
    return { ok: true, value: true };
  }

  setRewardThreshold(newThreshold: number): Result<boolean> {
    if (this.state.authorityContract === null) return { ok: false, value: false };
    if (newThreshold < 0 || newThreshold > 100) return { ok: false, value: false };
    this.state.rewardThreshold = newThreshold;
    return { ok: true, value: true };
  }

  submitProgress(
    courseId: number,
    progressHash: Uint8Array,
    milestoneId: number,
    score: number,
    attempts: number,
    level: number,
    difficulty: number,
    expiry: number
  ): Result<number> {
    if (this.state.nextProgressId >= this.state.maxProgresses) return { ok: false, value: ERR_MAX_PROGRESSES_EXCEEDED };
    if (courseId <= 0) return { ok: false, value: ERR_INVALID_COURSE_ID };
    if (progressHash.length !== 32) return { ok: false, value: ERR_INVALID_PROGRESS_HASH };
    if (milestoneId <= 0) return { ok: false, value: ERR_INVALID_MILESTONE_ID };
    if (score < 0 || score > 100) return { ok: false, value: ERR_INVALID_SCORE };
    if (attempts > 10) return { ok: false, value: ERR_INVALID_ATTEMPTS };
    if (level <= 0 || level > 10) return { ok: false, value: ERR_INVALID_LEVEL };
    if (difficulty < 1 || difficulty > 5) return { ok: false, value: ERR_INVALID_DIFFICULTY };
    if (expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (this.state.authorityContract === null) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const userMap = this.state.userProgress.get(this.caller) || new Map<number, Progress>();
    if (userMap.has(courseId)) return { ok: false, value: ERR_PROGRESS_ALREADY_EXISTS };

    this.stxTransfers.push({ amount: this.state.verificationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextProgressId;
    const progress: Progress = {
      progressHash,
      milestoneId,
      timestamp: this.blockHeight,
      verified: false,
      score,
      attempts,
      level,
      difficulty,
      expiry,
      status: true,
    };
    userMap.set(courseId, progress);
    this.state.userProgress.set(this.caller, userMap);
    this.state.progressById.set(id, { ...progress, user: this.caller, courseId });
    this.state.nextProgressId++;
    return { ok: true, value: id };
  }

  getProgress(user: string, courseId: number): Progress | null {
    return this.state.userProgress.get(user)?.get(courseId) || null;
  }

  getProgressById(id: number): ProgressWithUser | null {
    return this.state.progressById.get(id) || null;
  }

  verifyProgress(progressId: number, verifier: string): Result<boolean> {
    const progress = this.state.progressById.get(progressId);
    if (!progress) return { ok: false, value: false };
    if (this.caller !== verifier) return { ok: false, value: false };
    if (progress.verified) return { ok: false, value: false };
    if (progress.score < this.state.rewardThreshold) return { ok: false, value: false };
    const updated: ProgressWithUser = { ...progress, verified: true };
    this.state.progressById.set(progressId, updated);
    const userMap = this.state.userProgress.get(progress.user) || new Map();
    userMap.set(progress.courseId, { ...updated });
    this.state.userProgress.set(progress.user, userMap);
    return { ok: true, value: true };
  }

  updateProgress(progressId: number, newHash: Uint8Array, newMilestone: number, newScore: number): Result<boolean> {
    const progress = this.state.progressById.get(progressId);
    if (!progress) return { ok: false, value: false };
    if (progress.user !== this.caller) return { ok: false, value: false };
    if (newHash.length !== 32) return { ok: false, value: false };
    if (newMilestone <= 0) return { ok: false, value: false };
    if (newScore < 0 || newScore > 100) return { ok: false, value: false };
    if (progress.verified) return { ok: false, value: false };
    const updated: ProgressWithUser = {
      ...progress,
      progressHash: newHash,
      milestoneId: newMilestone,
      timestamp: this.blockHeight,
      score: newScore,
    };
    this.state.progressById.set(progressId, updated);
    const userMap = this.state.userProgress.get(this.caller) || new Map();
    userMap.set(progress.courseId, { ...updated });
    this.state.userProgress.set(this.caller, userMap);
    this.state.progressUpdates.set(progressId, {
      updateHash: newHash,
      updateMilestone: newMilestone,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      updateScore: newScore,
    });
    return { ok: true, value: true };
  }

  getProgressCount(): Result<number> {
    return { ok: true, value: this.state.nextProgressId };
  }

  checkProgressExistence(courseId: number): Result<boolean> {
    const userMap = this.state.userProgress.get(this.caller);
    return { ok: true, value: userMap ? userMap.has(courseId) : false };
  }
}

describe("ProgressTracker", () => {
  let contract: ProgressTrackerMock;

  beforeEach(() => {
    contract = new ProgressTrackerMock();
    contract.reset();
  });

  it("submits progress successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const progress = contract.getProgressById(0);
    expect(progress?.courseId).toBe(1);
    expect(progress?.progressHash).toEqual(hash);
    expect(progress?.milestoneId).toBe(1);
    expect(progress?.verified).toBe(false);
    expect(progress?.score).toBe(85);
    expect(progress?.attempts).toBe(2);
    expect(progress?.level).toBe(3);
    expect(progress?.difficulty).toBe(2);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate progress for same user and course", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    const result = contract.submitProgress(1, hash, 2, 90, 3, 4, 3, contract.blockHeight + 20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROGRESS_ALREADY_EXISTS);
  });

  it("rejects submission without authority contract", () => {
    const hash = new Uint8Array(32).fill(1);
    const result = contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid course id", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.submitProgress(0, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_COURSE_ID);
  });

  it("rejects invalid progress hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(31).fill(1);
    const result = contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROGRESS_HASH);
  });

  it("rejects invalid score", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.submitProgress(1, hash, 1, 101, 2, 3, 2, contract.blockHeight + 10);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_SCORE);
  });

  it("verifies progress successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    const result = contract.verifyProgress(0, "ST1TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const progress = contract.getProgressById(0);
    expect(progress?.verified).toBe(true);
  });

  it("rejects verification by wrong verifier", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    const result = contract.verifyProgress(0, "ST3FAKE");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects verification if already verified", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    contract.verifyProgress(0, "ST1TEST");
    const result = contract.verifyProgress(0, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects verification if score below threshold", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 70, 2, 3, 2, contract.blockHeight + 10);
    const result = contract.verifyProgress(0, "ST1TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates progress successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    const newHash = new Uint8Array(32).fill(2);
    const result = contract.updateProgress(0, newHash, 2, 90);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const progress = contract.getProgressById(0);
    expect(progress?.progressHash).toEqual(newHash);
    expect(progress?.milestoneId).toBe(2);
    expect(progress?.score).toBe(90);
    const update = contract.state.progressUpdates.get(0);
    expect(update?.updateHash).toEqual(newHash);
    expect(update?.updateMilestone).toBe(2);
    expect(update?.updateScore).toBe(90);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    contract.caller = "ST3FAKE";
    const newHash = new Uint8Array(32).fill(2);
    const result = contract.updateProgress(0, newHash, 2, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update if verified", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    contract.verifyProgress(0, "ST1TEST");
    const newHash = new Uint8Array(32).fill(2);
    const result = contract.updateProgress(0, newHash, 2, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets verification fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setVerificationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.verificationFee).toBe(1000);
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects verification fee change without authority", () => {
    const result = contract.setVerificationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct progress count", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash1 = new Uint8Array(32).fill(1);
    const hash2 = new Uint8Array(32).fill(2);
    contract.submitProgress(1, hash1, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    contract.submitProgress(2, hash2, 1, 90, 3, 4, 3, contract.blockHeight + 20);
    const result = contract.getProgressCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks progress existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    const result = contract.checkProgressExistence(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkProgressExistence(2);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects submission with invalid expiry", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight - 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_EXPIRY);
  });

  it("rejects submission with max progresses exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxProgresses = 1;
    const hash = new Uint8Array(32).fill(1);
    contract.submitProgress(1, hash, 1, 85, 2, 3, 2, contract.blockHeight + 10);
    const result = contract.submitProgress(2, hash, 2, 90, 3, 4, 3, contract.blockHeight + 20);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PROGRESSES_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});