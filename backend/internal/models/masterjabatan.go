package models

type MasterJabatan struct {
	Kode int    `gorm:"column:kode;primaryKey"`
	Nama string `gorm:"column:nama"`
}

func (MasterJabatan) TableName() string {
	return "masterjabatan"
}
