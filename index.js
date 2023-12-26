require('dotenv').config();
const PORT = process.env.PORT
const express = require('express');
const app = express();
const cors = require('cors');
const { connect_to_mongo } = require('./database/mongo');
const ProductController = require('./controllers/productController');

app.use(cors());
app.use(express.json())
// db connection
connect_to_mongo();

// routes
app.post('/create-product', ProductController.Create)
app.get('/product-list', ProductController.ProductList)
app.get('/product/:id', ProductController.ProductDetails)

app.post('/initialize-upload/:id', ProductController.ProductDetails)



app.listen(PORT, () => {
    console.log('server started at', PORT);
})