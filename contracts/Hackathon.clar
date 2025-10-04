(define-constant ERR_INVALID_STATE u100)
(define-constant ERR_NOT_AUTHORIZED u101)
(define-constant ERR_INVALID_TIME u102)
(define-constant ERR_NOT_FOUND u103)
(define-constant ERR_INVALID_THEME u104)
(define-constant ERR_INVALID_PRIZE u105)
(define-constant ERR_INVALID_JUDGES u106)
(define-constant ERR_ALREADY_REGISTERED u107)
(define-constant ERR_SUBMISSION_CLOSED u108)
(define-constant ERR_VOTING_CLOSED u109)
(define-constant ERR_INVALID_VOTE u110)
(define-constant ERR_INVALID_SUBMISSION u111)
(define-constant ERR_INVALID_PARTICIPANT u112)
(define-constant ERR_PRIZE_DISTRIBUTED u113)
(define-constant ERR_INSUFFICIENT_FUNDS u114)
(define-constant ERR_INVALID_DURATION u115)
(define-constant ERR_INVALID_CATEGORY u116)
(define-constant ERR_MAX_SUBMISSIONS_EXCEEDED u117)
(define-constant ERR_INVALID_ENTRY_FEE u118)
(define-constant ERR_INVALID_REWARD_SPLIT u119)
(define-constant ERR_INVALID_SPONSOR u120)

(define-constant STATE_REGISTRATION u0)
(define-constant STATE_SUBMISSION u1)
(define-constant STATE_VOTING u2)
(define-constant STATE_CLOSED u3)

(define-data-var owner principal tx-sender)
(define-data-var current-state uint STATE_REGISTRATION)
(define-data-var start-time uint u0)
(define-data-var submission-end uint u0)
(define-data-var voting-end uint u0)
(define-data-var theme (string-utf8 100) u"")
(define-data-var prize-pool uint u0)
(define-data-var entry-fee uint u0)
(define-data-var max-submissions uint u50)
(define-data-var reward-split uint u70)
(define-data-var next-submission-id uint u0)
(define-data-var next-participant-id uint u0)

(define-map participants uint {address: principal, registered-at: uint})
(define-map submissions uint {participant-id: uint, hash: (buff 32), description: (string-utf8 500), timestamp: uint, votes: uint, category: (string-utf8 50)})
(define-map votes {voter: principal, submission-id: uint} bool)
(define-map judges principal bool)
(define-map sponsors principal uint)
(define-map categories (string-utf8 50) bool)

(define-read-only (get-current-state)
  (var-get current-state)
)

(define-read-only (get-hackathon-details)
  {
    state: (var-get current-state),
    start: (var-get start-time),
    submission-end: (var-get submission-end),
    voting-end: (var-get voting-end),
    theme: (var-get theme),
    prize: (var-get prize-pool),
    fee: (var-get entry-fee),
    max-subs: (var-get max-submissions),
    split: (var-get reward-split)
  }
)

(define-read-only (get-participant (id uint))
  (map-get? participants id)
)

(define-read-only (get-submission (id uint))
  (map-get? submissions id)
)

(define-read-only (has-voted (voter principal) (sub-id uint))
  (default-to false (map-get? votes {voter: voter, submission-id: sub-id}))
)

(define-read-only (is-judge (judge principal))
  (default-to false (map-get? judges judge))
)

(define-read-only (get-sponsor-contribution (sponsor principal))
  (default-to u0 (map-get? sponsors sponsor))
)

(define-read-only (is-category-valid (cat (string-utf8 50)))
  (default-to false (map-get? categories cat))
)

(define-private (validate-time (time uint))
  (if (> time block-height) (ok true) (err ERR_INVALID_TIME))
)

(define-private (validate-theme (th (string-utf8 100)))
  (if (and (> (len th) u0) (<= (len th) u100)) (ok true) (err ERR_INVALID_THEME))
)

(define-private (validate-prize (pr uint))
  (if (> pr u0) (ok true) (err ERR_INVALID_PRIZE))
)

(define-private (validate-judges (j principal))
  (if (not (is-eq j tx-sender)) (ok true) (err ERR_INVALID_JUDGES))
)

(define-private (validate-submission (hash (buff 32)) (desc (string-utf8 500)) (cat (string-utf8 50)))
  (if (and (is-ok (validate-category cat)) (> (len desc) u0)) (ok true) (err ERR_INVALID_SUBMISSION))
)

(define-private (validate-vote (sub-id uint))
  (if (is-some (map-get? submissions sub-id)) (ok true) (err ERR_INVALID_VOTE))
)

(define-private (validate-participant (p principal))
  (if (not (is-eq p tx-sender)) (ok true) (err ERR_INVALID_PARTICIPANT))
)

(define-private (validate-duration (dur uint))
  (if (> dur u0) (ok true) (err ERR_INVALID_DURATION))
)

(define-private (validate-category (cat (string-utf8 50)))
  (if (is-category-valid cat) (ok true) (err ERR_INVALID_CATEGORY))
)

(define-private (validate-entry-fee (fee uint))
  (if (>= fee u0) (ok true) (err ERR_INVALID_ENTRY_FEE))
)

(define-private (validate-reward-split (split uint))
  (if (and (> split u0) (<= split u100)) (ok true) (err ERR_INVALID_REWARD_SPLIT))
)

(define-private (validate-sponsor (sp principal))
  (if (not (is-eq sp tx-sender)) (ok true) (err ERR_INVALID_SPONSOR))
)

(define-public (initialize (st uint) (sub-end uint) (vot-end uint) (th (string-utf8 100)) (pr uint) (fee uint) (max-sub uint) (split uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-eq (var-get current-state) STATE_REGISTRATION) (err ERR_INVALID_STATE))
    (try! (validate-time st))
    (try! (validate-time sub-end))
    (try! (validate-time vot-end))
    (try! (validate-theme th))
    (try! (validate-prize pr))
    (try! (validate-entry-fee fee))
    (try! (validate-duration (- sub-end st)))
    (try! (validate-duration (- vot-end sub-end)))
    (try! (validate-reward-split split))
    (var-set start-time st)
    (var-set submission-end sub-end)
    (var-set voting-end vot-end)
    (var-set theme th)
    (var-set prize-pool pr)
    (var-set entry-fee fee)
    (var-set max-submissions max-sub)
    (var-set reward-split split)
    (ok true)
  )
)

(define-public (add-judge (judge principal))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (try! (validate-judges judge))
    (map-set judges judge true)
    (ok true)
  )
)

(define-public (add-category (cat (string-utf8 50)))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (map-set categories cat true)
    (ok true)
  )
)

(define-public (sponsor-hackathon (amount uint))
  (begin
    (try! (validate-sponsor tx-sender))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set sponsors tx-sender (+ (get-sponsor-contribution tx-sender) amount))
    (var-set prize-pool (+ (var-get prize-pool) amount))
    (ok true)
  )
)

(define-public (register-participant)
  (let ((id (var-get next-participant-id)))
    (asserts! (is-eq (var-get current-state) STATE_REGISTRATION) (err ERR_INVALID_STATE))
    (asserts! (> (var-get start-time) block-height) (err ERR_INVALID_TIME))
    (asserts! (is-none (fold check-participant-registered participants {address: tx-sender, found: false})) (err ERR_ALREADY_REGISTERED))
    (if (> (var-get entry-fee) u0)
      (try! (stx-transfer? (var-get entry-fee) tx-sender (as-contract tx-sender)))
      (ok true)
    )
    (map-set participants id {address: tx-sender, registered-at: block-height})
    (var-set next-participant-id (+ id u1))
    (ok id)
  )
)

(define-public (submit-project (hash (buff 32)) (desc (string-utf8 500)) (cat (string-utf8 50)))
  (let ((id (var-get next-submission-id)) (part-id (find-participant tx-sender)))
    (asserts! (is-eq (var-get current-state) STATE_SUBMISSION) (err ERR_SUBMISSION_CLOSED))
    (asserts! (and (>= block-height (var-get start-time)) (< block-height (var-get submission-end))) (err ERR_INVALID_TIME))
    (asserts! (< id (var-get max-submissions)) (err ERR_MAX_SUBMISSIONS_EXCEEDED))
    (asserts! (is-some part-id) (err ERR_INVALID_PARTICIPANT))
    (try! (validate-submission hash desc cat))
    (map-set submissions id {participant-id: (unwrap! part-id (err ERR_NOT_FOUND)), hash: hash, description: desc, timestamp: block-height, votes: u0, category: cat})
    (var-set next-submission-id (+ id u1))
    (ok id)
  )
)

(define-public (vote-on-submission (sub-id uint))
  (begin
    (asserts! (is-eq (var-get current-state) STATE_VOTING) (err ERR_VOTING_CLOSED))
    (asserts! (and (>= block-height (var-get submission-end)) (< block-height (var-get voting-end))) (err ERR_INVALID_TIME))
    (asserts! (or (is-judge tx-sender) true) (err ERR_NOT_AUTHORIZED))
    (try! (validate-vote sub-id))
    (asserts! (not (has-voted tx-sender sub-id)) (err ERR_INVALID_VOTE))
    (let ((sub (unwrap! (map-get? submissions sub-id) (err ERR_NOT_FOUND))))
      (map-set submissions sub-id (merge sub {votes: (+ (get votes sub) u1)}))
    )
    (map-set votes {voter: tx-sender, submission-id: sub-id} true)
    (ok true)
  )
)

(define-public (close-hackathon)
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (asserts! (>= block-height (var-get voting-end)) (err ERR_INVALID_TIME))
    (var-set current-state STATE_CLOSED)
    (ok true)
  )
)

(define-public (distribute-prizes)
  (begin
    (asserts! (is-eq (var-get current-state) STATE_CLOSED) (err ERR_INVALID_STATE))
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (let ((top-subs (sort-submissions-by-votes)) (total-prize (var-get prize-pool)) (split (var-get reward-split)))
      (asserts! (> (len top-subs) u0) (err ERR_NOT_FOUND))
      (asserts! (> total-prize u0) (err ERR_INSUFFICIENT_FUNDS))
      (fold distribute-to-winner top-subs total-prize split)
    )
    (ok true)
  )
)

(define-private (find-participant (addr principal))
  (fold match-participant participants {addr: addr, id: none})
)

(define-private (match-participant (entry {address: principal, registered-at: uint}) (acc {addr: principal, id: (optional uint)}))
  (if (is-eq (get address entry) (get addr acc))
    (merge acc {id: (some (get id entry))})
    acc
  )
)

(define-private (check-participant-registered (entry {address: principal, registered-at: uint}) (acc {address: principal, found: bool}))
  (if (is-eq (get address entry) (get address acc))
    (merge acc {found: true})
    acc
  )
)

(define-private (sort-submissions-by-votes)
  (list ) ;; Placeholder for sorting logic, expand as needed
)

(define-private (distribute-to-winner (sub-id uint) (prize uint) (split uint))
  (let ((sub (unwrap-panic (map-get? submissions sub-id))) (part (unwrap-panic (map-get? participants (get participant-id sub)))) (amount (/ (* prize split) u100)))
    (as-contract (stx-transfer? amount tx-sender (get address part)))
    prize
  )
)

(define-public (advance-state)
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (let ((state (var-get current-state)))
      (if (is-eq state STATE_REGISTRATION)
        (if (>= block-height (var-get start-time)) (var-set current-state STATE_SUBMISSION) (err ERR_INVALID_TIME))
        (if (is-eq state STATE_SUBMISSION)
          (if (>= block-height (var-get submission-end)) (var-set current-state STATE_VOTING) (err ERR_INVALID_TIME))
          (if (is-eq state STATE_VOTING)
            (if (>= block-height (var-get voting-end)) (var-set current-state STATE_CLOSED) (err ERR_INVALID_TIME))
            (err ERR_INVALID_STATE)
          )
        )
      )
    )
    (ok (var-get current-state))
  )
)

(define-public (update-prize-pool (new-prize uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (try! (validate-prize new-prize))
    (var-set prize-pool new-prize)
    (ok true)
  )
)

(define-public (update-entry-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (try! (validate-entry-fee new-fee))
    (var-set entry-fee new-fee)
    (ok true)
  )
)

(define-public (update-max-submissions (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (asserts! (> new-max u0) (err ERR_INVALID_PRIZE))
    (var-set max-submissions new-max)
    (ok true)
  )
)

(define-public (update-reward-split (new-split uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (try! (validate-reward-split new-split))
    (var-set reward-split new-split)
    (ok true)
  )
)

(define-public (withdraw-funds (amount uint))
  (begin
    (asserts! (is-eq tx-sender (var-get owner)) (err ERR_NOT_AUTHORIZED))
    (asserts! (is-eq (var-get current-state) STATE_CLOSED) (err ERR_INVALID_STATE))
    (asserts! (<= amount (as-contract (stx-get-balance tx-sender))) (err ERR_INSUFFICIENT_FUNDS))
    (as-contract (stx-transfer? amount tx-sender (var-get owner)))
    (ok true)
  )
)