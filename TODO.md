# TODO - Master Leader Task Permission + createdBy

- [x] Step 1: Update DB schema in `scripts/init_tables.sql` to add `created_by` to `xv_task`
- [x] Step 2: Update model `backend/internal/models/models.go` to include `CreatedBy` field on `Task`
- [x] Step 3: Backend logic di `backend/internal/graph/schema.go`
  - [x] Tambah input `targetUserKode` pada `CreateTaskInput`

  - [x] Validasi permission berdasarkan `masterpegawai.statusLeader`
  - [ ] Jika leader dan target ada di divisi yang sama => set `task.UserKode = targetUserKode`, `task.CreatedBy = claims.Kodeku`
  - [ ] Jika bukan leader => silent override: abaikan targetUserKode dan paksa task untuk diri sendiri

- [x] Step 4: Frontend UI
  - [ ] Update `CreateTaskModal` untuk leader: tampilkan dropdown targetUserKode dalam divisi
  - [ ] Tambahkan query list pegawai divisi (GraphQL) dan wiring di frontend
- [ ] Step 5: Update queries/mutations di `frontend/src/lib/queries.ts`
- [ ] Step 6: Build & run checks
  - [ ] `cd backend && go test ./...`
  - [ ] `cd frontend && npm run build`
