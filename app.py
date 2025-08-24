from flask import Flask, render_template, jsonify, request, session
import requests
from flask_mail import Mail, Message

# -------------------------
# Flask App Setup
# -------------------------
app = Flask(__name__)
app.secret_key = "your-secret-key"  # Needed for session usage

# -------------------------
# Flask-Mail Configuration
# -------------------------
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = "vongnethe@gmail.com"   # change this
app.config['MAIL_PASSWORD'] = "jzny mwvz zchn zrzy"  # change this (App Password!)
app.config['MAIL_DEFAULT_SENDER'] = "vongnethe@gmail.com"

mail = Mail(app)

last_order = {}

# -------------------------
# Routes
# -------------------------
@app.get("/")
@app.get("/home")
def home():
    from product import products
    return render_template('home.html', product_list=products)


@app.get("/product-detail")
def product_detail():
    from product import getByID
    pro_id = request.args.get('pro_id', type=int)
    product = getByID(pro_id)
    return render_template('product_detail.html', product=product)


@app.get('/cart')
def cart():
    return render_template('cart.html')


@app.get('/about')
def about():
    return render_template('about.html')


@app.get('/contact')
def contact():
    return render_template('contact.html')


@app.get('/checkout')
def checkout():
    return render_template('checkout.html')


# -------------------------
# Checkout POST (send email + store last_order)
# -------------------------
@app.post('/checkout')
def checkout_submit():
    global last_order
    data = request.get_json()

    last_order = data  # store order globally for reference in Telegram webhook

    customer_email = data.get("email")
    items = data.get("items", [])
    subtotal = data.get("subtotal", 0)
    shipping = data.get("shipping", 0)
    total = data.get("total", subtotal + shipping)
    payment = data.get("payment", "Unknown")
    address = data.get("address", "Unknown")
    phone = data.get("phone", "Unknown")
    location = data.get("location", "Unknown")

    # Build order summary for email
    item_lines = "\n".join(
        [f"- {item['title']} x{item['qty']} = ${item['price'] * item['qty']:.2f}" for item in items]
    )

    email_body = f"""
Hello,

✅ Your order has been placed!

Order Details:
{item_lines}

Subtotal: ${subtotal:.2f}
Shipping: ${shipping:.2f}
Total: ${total:.2f}

Payment: {payment}
Address: {address}
Phone: {phone}
Location: {location}

Thank you for shopping with us! 🎉
"""

    try:
        msg = Message(
            subject="Your order has been placed 🎉",
            recipients=[customer_email],
            body=email_body
        )
        mail.send(msg)
        print(f"✅ Confirmation email sent to {customer_email}")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")

    return jsonify({"status": "ok", "message": "Checkout info saved and email sent"})


@app.get('/api/products')
def products_api():
    product = [
        {
            'id': 1,
            'name': 'coca',
            'category': 'drink',
            'cost': '0.25',
            'price': '0.5',
            'image': '/static/coca.jpeg',
        }
    ]
    return jsonify(product)


# -------------------------
# Telegram Webhook for seller
# -------------------------
@app.post('/telegram-webhook')
def telegram_webhook():
    data = request.json
    if 'callback_query' in data:
        callback = data['callback_query']
        message_id = callback['message']['message_id']
        chat_id = callback['message']['chat']['id']
        callback_data = callback['data']

        if callback_data.startswith("accept_order_"):
            order_id = callback_data.split("_")[-1]

            # Respond to Telegram button
            bot_token = "7841722560:AAGlrPxtaHMa6CIv6QulCdD2ncc06LEoe44"
            url = f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery"
            requests.post(url, json={"callback_query_id": callback['id'], "text": "Order Accepted ✅"})

            # Edit Telegram message
            edit_url = f"https://api.telegram.org/bot{bot_token}/editMessageText"
            requests.post(edit_url, json={
                "chat_id": chat_id,
                "message_id": message_id,
                "reply_markup": None
            })

    return '', 200


# -------------------------
# Run Flask
# -------------------------
if __name__ == "__main__":
    app.run(debug=True)
