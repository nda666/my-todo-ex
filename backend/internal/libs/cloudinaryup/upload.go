package cloudinaryup

import (
	"context"
	"mime/multipart"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

func UploadAvatar(ctx context.Context, file multipart.File, kodeku string) (string, error) {
	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		return "", err
	}

	overwrite := true
	resp, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{
		PublicID:  "avatars/" + kodeku,
		Folder:    "avatars",
		Overwrite: api.Bool(overwrite),
	})
	// fmt.Println(resp.)
	if err != nil {
		return "", err
	}

	return resp.SecureURL, nil
}
