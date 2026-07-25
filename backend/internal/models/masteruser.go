package models

type MasterUser struct {
	Kodeku          string         `gorm:"column:kodeku;primaryKey"`
	Usernameku      string         `gorm:"column:usernameku"`
	Passwordku      string         `gorm:"column:passwordku"`
	UserKodePegawai int            `gorm:"column:userkodepegawai"`
	Pegawai         *MasterPegawai `gorm:"foreignKey:UserKodePegawai;references:Kode"`
	Profile         *Profile       `gorm:"foreignKey:Kodeku;references:Kodeku"`
}

func (MasterUser) TableName() string {
	return "masteruser"
}
