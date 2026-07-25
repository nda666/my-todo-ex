package models

type Jabatan struct {
	Kode int
	Nama string
}

type Divisi struct {
	Kode int
	Nama string
}

type Pegawai struct {
	Kode         int
	Nama         string
	KodeJabatan  int
	KodeDivisi   int
	StatusLeader int
	Jabatan      *Jabatan
	Divisi       *Divisi
}

type User struct {
	Kodeku    string // sekarang berisi kode pegawai (stringified), lihat catatan desain
	Username  string
	AvatarURL string
	Pegawai   *Pegawai
}
