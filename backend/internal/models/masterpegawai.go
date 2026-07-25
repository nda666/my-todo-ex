package models

type MasterPegawai struct {
	Kode         int            `gorm:"column:kode;primaryKey"`
	Nama         string         `gorm:"column:nama"`
	KodeJabatan  int            `gorm:"column:kodejabatan"`
	KodeDivisi   int            `gorm:"column:kodedivisi"`
	StatusLeader int            `gorm:"column:statusLeader"`
	Jabatan      *MasterJabatan `gorm:"foreignKey:KodeJabatan;references:Kode"`
	Divisi       *MasterDivisi  `gorm:"foreignKey:KodeDivisi;references:Kode"`
}

func (MasterPegawai) TableName() string {
	return "masterpegawai"
}
