(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-COURSE-ID u101)
(define-constant ERR-INVALID-MILESTONE-ID u102)
(define-constant ERR-INVALID-PROGRESS-HASH u103)
(define-constant ERR-INVALID-VERIFICATION u104)
(define-constant ERR-PROGRESS-ALREADY-EXISTS u105)
(define-constant ERR-PROGRESS-NOT-FOUND u106)
(define-constant ERR-INVALID-TIMESTAMP u107)
(define-constant ERR-USER-NOT-REGISTERED u108)
(define-constant ERR-INVALID-PROOF u109)
(define-constant ERR-MAX-PROGRESSES-EXCEEDED u110)
(define-constant ERR-INVALID-REWARD-THRESHOLD u111)
(define-constant ERR-INVALID-UPDATE u112)
(define-constant ERR-INVALID-STATUS u113)
(define-constant ERR-INVALID-LEVEL u114)
(define-constant ERR-INVALID-DIFFICULTY u115)
(define-constant ERR-INVALID-EXPIRY u116)
(define-constant ERR-INVALID-SCORE u117)
(define-constant ERR-INVALID-ATTEMPTS u118)
(define-constant ERR-INVALID-COMPLETION-RATE u119)
(define-constant ERR-INVALID-VERIFIER u120)

(define-data-var next-progress-id uint u0)
(define-data-var max-progresses uint u10000)
(define-data-var verification-fee uint u500)
(define-data-var reward-threshold uint u80)
(define-data-var authority-contract (optional principal) none)

(define-map UserProgress
  { user: principal, course-id: uint }
  {
    progress-hash: (buff 32),
    milestone-id: uint,
    timestamp: uint,
    verified: bool,
    score: uint,
    attempts: uint,
    level: uint,
    difficulty: uint,
    expiry: uint,
    status: bool
  }
)

(define-map ProgressById
  uint
  {
    user: principal,
    course-id: uint,
    progress-hash: (buff 32),
    milestone-id: uint,
    timestamp: uint,
    verified: bool,
    score: uint,
    attempts: uint,
    level: uint,
    difficulty: uint,
    expiry: uint,
    status: bool
  }
)

(define-map ProgressUpdates
  uint
  {
    update-hash: (buff 32),
    update-milestone: uint,
    update-timestamp: uint,
    updater: principal,
    update-score: uint
  }
)

(define-read-only (get-progress (user principal) (course-id uint))
  (map-get? UserProgress { user: user, course-id: course-id })
)

(define-read-only (get-progress-by-id (id uint))
  (map-get? ProgressById id)
)

(define-read-only (get-progress-update (id uint))
  (map-get? ProgressUpdates id)
)

(define-read-only (is-progress-registered (user principal) (course-id uint))
  (is-some (map-get? UserProgress { user: user, course-id: course-id }))
)

(define-private (validate-course-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-COURSE-ID))
)

(define-private (validate-milestone-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-MILESTONE-ID))
)

(define-private (validate-progress-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-PROGRESS-HASH))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-score (score uint))
  (if (and (>= score u0) (<= score u100))
      (ok true)
      (err ERR-INVALID-SCORE))
)

(define-private (validate-attempts (attempts uint))
  (if (<= attempts u10)
      (ok true)
      (err ERR-INVALID-ATTEMPTS))
)

(define-private (validate-level (level uint))
  (if (and (> level u0) (<= level u10))
      (ok true)
      (err ERR-INVALID-LEVEL))
)

(define-private (validate-difficulty (diff uint))
  (if (and (>= diff u1) (<= diff u5))
      (ok true)
      (err ERR-INVALID-DIFFICULTY))
)

(define-private (validate-expiry (exp uint))
  (if (> exp block-height)
      (ok true)
      (err ERR-INVALID-EXPIRY))
)

(define-private (validate-status (status bool))
  (ok true)
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-progresses (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-PROGRESSES-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set max-progresses new-max)
    (ok true)
  )
)

(define-public (set-verification-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set verification-fee new-fee)
    (ok true)
  )
)

(define-public (set-reward-threshold (new-threshold uint))
  (begin
    (asserts! (and (>= new-threshold u0) (<= new-threshold u100)) (err ERR-INVALID-REWARD-THRESHOLD))
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set reward-threshold new-threshold)
    (ok true)
  )
)

(define-public (submit-progress
  (course-id uint)
  (progress-hash (buff 32))
  (milestone-id uint)
  (score uint)
  (attempts uint)
  (level uint)
  (difficulty uint)
  (expiry uint)
)
  (let (
        (next-id (var-get next-progress-id))
        (current-max (var-get max-progresses))
        (authority (var-get authority-contract))
        (current-timestamp block-height)
      )
    (asserts! (< next-id current-max) (err ERR-MAX-PROGRESSES-EXCEEDED))
    (try! (validate-course-id course-id))
    (try! (validate-progress-hash progress-hash))
    (try! (validate-milestone-id milestone-id))
    (try! (validate-score score))
    (try! (validate-attempts attempts))
    (try! (validate-level level))
    (try! (validate-difficulty difficulty))
    (try! (validate-expiry expiry))
    (asserts! (not (is-progress-registered tx-sender course-id)) (err ERR-PROGRESS-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-NOT-AUTHORIZED))))
      (try! (stx-transfer? (var-get verification-fee) tx-sender authority-recipient))
    )
    (map-set UserProgress { user: tx-sender, course-id: course-id }
      {
        progress-hash: progress-hash,
        milestone-id: milestone-id,
        timestamp: current-timestamp,
        verified: false,
        score: score,
        attempts: attempts,
        level: level,
        difficulty: difficulty,
        expiry: expiry,
        status: true
      }
    )
    (map-set ProgressById next-id
      {
        user: tx-sender,
        course-id: course-id,
        progress-hash: progress-hash,
        milestone-id: milestone-id,
        timestamp: current-timestamp,
        verified: false,
        score: score,
        attempts: attempts,
        level: level,
        difficulty: difficulty,
        expiry: expiry,
        status: true
      }
    )
    (var-set next-progress-id (+ next-id u1))
    (print { event: "progress-submitted", id: next-id, user: tx-sender, course-id: course-id })
    (ok next-id)
  )
)

(define-public (verify-progress (progress-id uint) (verifier principal))
  (let ((progress (map-get? ProgressById progress-id)))
    (match progress
      p
        (begin
          (asserts! (is-eq tx-sender verifier) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get verified p)) (err ERR-INVALID-VERIFICATION))
          (asserts! (>= (get score p) (var-get reward-threshold)) (err ERR-INVALID_SCORE))
          (map-set ProgressById progress-id
            (merge p { verified: true }))
          (map-set UserProgress { user: (get user p), course-id: (get course-id p) }
            (merge p { verified: true }))
          (print { event: "progress-verified", id: progress-id })
          (ok true)
        )
      (err ERR-PROGRESS-NOT-FOUND)
    )
  )
)

(define-public (update-progress
  (progress-id uint)
  (new-hash (buff 32))
  (new-milestone uint)
  (new-score uint)
)
  (let ((progress (map-get? ProgressById progress-id)))
    (match progress
      p
        (begin
          (asserts! (is-eq (get user p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-progress-hash new-hash))
          (try! (validate-milestone-id new-milestone))
          (try! (validate-score new-score))
          (asserts! (not (get verified p)) (err ERR-INVALID-UPDATE))
          (map-set ProgressById progress-id
            (merge p {
              progress-hash: new-hash,
              milestone-id: new-milestone,
              timestamp: block-height,
              score: new-score
            }))
          (map-set UserProgress { user: tx-sender, course-id: (get course-id p) }
            (merge p {
              progress-hash: new-hash,
              milestone-id: new-milestone,
              timestamp: block-height,
              score: new-score
            }))
          (map-set ProgressUpdates progress-id
            {
              update-hash: new-hash,
              update-milestone: new-milestone,
              update-timestamp: block-height,
              updater: tx-sender,
              update-score: new-score
            }
          )
          (print { event: "progress-updated", id: progress-id })
          (ok true)
        )
      (err ERR-PROGRESS-NOT-FOUND)
    )
  )
)

(define-public (get-progress-count)
  (ok (var-get next-progress-id))
)

(define-public (check-progress-existence (course-id uint))
  (ok (is-progress-registered tx-sender course-id))
)