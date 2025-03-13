package main

import (
	"fmt"
	"os"

	"github.com/gin-gonic/gin"
)

// add middleware to deal cross-origin problem
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// set header to allow all origin
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		// set header to allow all method
		c.Writer.Header().Set("Access-Control-Allow-Methods", "*")
		// set header to allow all headers
		c.Writer.Header().Set("Access-Control-Allow-Headers", "*")
		// if request method is options, return 200
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(200)
			return
		}
		// continue to the next middleware
		c.Next()
	}
}

func postData(c *gin.Context) {
	// read data from body , print the body to stdio
	fmt.Println(c.Request.Body)
	c.JSON(200, gin.H{
		"message": "success",
	})
}

func getFiles(dir string) ([]string, error) {
	// read all files in the directory
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	// return all file name
	var fileNames []string
	for _, file := range files {
		fileNames = append(fileNames, file.Name())
	}
	return fileNames, nil
}

func getFilesList(c *gin.Context) {
	files, _ := getFiles("uploads")
	c.JSON(200, gin.H{
		"files": files,
	})
}

func main() {
	g:=gin.Default()

	api:=g.Group("/api")
	api.Use(CORSMiddleware())
	{
		// use post method to create a new file in local storage
		api.POST("/upload", postData)
		// use get method to get all files in local storage
		api.GET("/list", getFilesList)
	}

	g.Run(":8080")
}