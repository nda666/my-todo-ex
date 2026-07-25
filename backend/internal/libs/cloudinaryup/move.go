package cloudinaryup

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/cloudinary/cloudinary-go/v2"

	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

func MoveAssetIdToPublicFolder(ctx context.Context, publicId string) (string, error) {
	cld, err := cloudinary.NewFromParams(
		os.Getenv("CLOUDINARY_CLOUD_NAME"),
		os.Getenv("CLOUDINARY_API_KEY"),
		os.Getenv("CLOUDINARY_API_SECRET"),
	)
	if err != nil {
		return "", err
	}

	resp, err := cld.Upload.Rename(ctx, uploader.RenameParams{
		FromPublicID: publicId,
		ToPublicID:   strings.Replace(publicId, "temp_upload", "public_upload", -1),
	})
	fmt.Println(resp.SecureURL, err)
	if err != nil {
		return "", err
	}

	return resp.SecureURL, nil
}
