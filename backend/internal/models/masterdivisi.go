package models

type MasterDivisi struct {
	Kode int    `gorm:"column:kode;primaryKey"`
	Nama string `gorm:"column:nama"`
}

func (MasterDivisi) TableName() string {
	return "masterdivisi"
}
