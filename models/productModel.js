exports.ProductModel = async () => {
    return await central_app_conn.collection("products");
}
