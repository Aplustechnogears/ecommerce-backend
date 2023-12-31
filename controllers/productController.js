const AWS = require('aws-sdk');
const { ProductModel } = require('../models/productModel');
const { ObjectId } = require('mongodb');
const _ = require('lodash');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
    region: 'us-east-1',
});

const s3 = new AWS.S3();

const status_code = {
    OK: 200
}


const BUCKET_NAME = 'anmol-bucket01';
const ProductController = {


    Create: async (req, res) => {

        const payload = {
            name: req.body.name,
            price: req.body.price,
            description: req.body.description,
            created_at: Date.now(),
            updated_at: Date.now(),
            category: req.body.category,
            referral: req.body.link,
            image_key: req.body.image_key
        }


        const productModelObj = await ProductModel();
        const insert_ack = await productModelObj.insertOne(payload)
        console.log('insert_ack____', insert_ack);

        res.status(201).json({ message: "Record created successfully" })

    },

    ProductList: async (req, res) => {
        try {
            const productModalObj = await ProductModel();
            const filters = {};
            const sort = {};
            const pageNumber = req.query.page;
            const pageSize = req.query.size || 100;
            const skip = (pageNumber - 1) * pageSize;

            if (req.query.category) {
                filters.category = req.query.category
            }

            const product_list = await productModalObj.find(filters).sort(sort).skip(skip).limit(pageSize).toArray();
            const totalCount = await productModalObj.countDocuments(filters);
            const images_key = product_list?.map(item => item?.image_key);
            const images_key_value = {};
            const signed_url_promises = [];

            for (let i in images_key) {
                const params = {
                    Bucket: 'anmol-bucket01',
                    Key: images_key[i],
                    Expires: 1200,
                };
                signed_url_promises.push(s3.getSignedUrl('getObject', params));
            }
            const al_urls_payload = await Promise.allSettled(signed_url_promises);

            for (let i in al_urls_payload) {
                images_key_value[images_key[i]] = al_urls_payload[i].value;
            }

            const new_list = product_list.map(item => { return { ...item, image_src: images_key_value[item.image_key] } })

            res.status(200).json({ records: new_list, total_records: totalCount })

        } catch (error) {

        }
    },

    ProductDetails: async (req, res) => {
        try {
            console.log('calldddd');
            const record_id = req.params.id;
            const productModalObj = await ProductModel();
            const product = await productModalObj.findOne({ _id: new ObjectId(record_id) });
            const params = {
                Bucket: 'anmol-bucket01',
                Key: product.image_key,
                Expires: 1200,
            };
            const signed_url = await s3.getSignedUrl('getObject', params);
            res.status(200).json({ ...product, src: signed_url })
        } catch (error) {
            console.log(' error___', error);
        }
    },

    initializeMultipartUpload: async (req, res) => {
        const jsonResponse = {
            statusCode: status_code.OK,
            message: "",
            status: true,
            data: {}
        }
        try {
            let name = Date.now().toString();
            const multipartParams = {
                Bucket: BUCKET_NAME,
                Key: `${name}`,
                ACL: "bucket-owner-full-control",
            }
            const multipartUpload = await s3.createMultipartUpload(multipartParams).promise();
            jsonResponse.data = {
                fileId: multipartUpload.UploadId,
                fileKey: multipartUpload.Key,
                file_name: name,
            }
        }

        catch (error) {
            jsonResponse.message = error.message;
            jsonResponse.statusCode = 500
        } finally {
            res.status(jsonResponse.statusCode).json({ message: jsonResponse.message, data: jsonResponse.data })
        }
    },

    getMultipartPreSignedUrls: async (req, res) => {
        try {

            const { fileKey, fileId, parts } = req.body
            const multipartParams = {
                Bucket: BUCKET_NAME,
                Key: fileKey,
                UploadId: fileId,
            }
            const promises = []
            for (let index = 0; index < parts; index++) {
                promises.push(
                    s3.getSignedUrlPromise("uploadPart", {
                        ...multipartParams,
                        PartNumber: index + 1,
                    }),
                )
            }
            const signedUrls = await Promise.all(promises)
            const partSignedUrlList = signedUrls.map((signedUrl, index) => {
                return {
                    signedUrl: signedUrl,
                    PartNumber: index + 1,
                }
            })
            res.status(200).json({
                parts: partSignedUrlList,
            })
        } catch (error) {
            console.log(error, "bb-->")
        }
    },

    finalizeMultipartUpload: async (req, res) => {
        try {

            const { fileId, fileKey, parts, file_extension, file_name } = req.body
            const multipartParams = {
                Bucket: BUCKET_NAME,
                Key: fileKey,
                UploadId: fileId,
                MultipartUpload: {

                    // ordering the parts to make sure they are in the right order
                    Parts: _.orderBy(parts, ["PartNumber"], ["asc"]),
                },
            }

            await s3.completeMultipartUpload(multipartParams).promise();

            //  store and process attachment here further here.

            const attachment_details = await s3.headObject({ Bucket: BUCKET_NAME, Key: fileKey }).promise();
            res.status(200).json({ ...attachment_details, fileKey })

        } catch (error) {
            console.log(error, "ccc---->>")
        }
    },
}

module.exports = ProductController;