const AWS = require('aws-sdk');
const { ProductModel } = require('../models/productModel');
const { ObjectId } = require('mongodb');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
    region: 'us-east-1',
});

const s3 = new AWS.S3();

const ProductController = {


    Create: async (req, res) => {

        const payload = {
            name: req.body.name,
            price: req.body.price,
            description: req.body.description,
            created_at: Date.now(),
            updated_at: Date.now(),
            category: req.body.category,
            referral: req.body.referral
        }

        // images handle in base64
        const image_base64 = req.body.image;

        // upload to s3.
        const buffer = Buffer.from(image_base64, 'base64');

        const params = {
            Bucket: 'anmol-bucket01',
            Key: Date.now().toString() + '.png',
            Body: buffer,
        };

        const response = await s3.upload({ ...params, ContentType: 'image/png' }).promise();
        payload.image_key = response.Key;

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
            const record_id = req.params.id;
            const productModalObj = await ProductModel();
            const product = await productModalObj.findOne({ _id: new ObjectId(record_id) });
            res.status(200).json(product)
        } catch (error) {
            console.log(' error___', error);
        }
    }
}

module.exports = ProductController;