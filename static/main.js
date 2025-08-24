const { createApp } = Vue;

createApp({
    delimiters: ['[[', ']]'],
    mounted() {
        let cart = JSON.parse(localStorage.getItem('cart_list') ?? '[]');
        this.cart_list = cart;

        let customer = JSON.parse(localStorage.getItem('customer_info') ?? '{}');
        if (Object.keys(customer).length) {
            this.customer = customer;
        }
    },
    data() {
        return {
            cart_list: [],
            grand_total: 0,
            shipping_fee: 1.5,
            customer: {
                name: '',
                email: '',
                phone: '',
                location: '',
                payment: ''
            }
        };
    },
    methods: {
        addToCart(product) {
            let found = this.cart_list.find(item => item.id === product.id);
            if (found) {
                found.qty++;
            } else {
                product.qty = 1;
                this.cart_list.push(product);
            }
            localStorage.setItem('cart_list', JSON.stringify(this.cart_list));
            Swal.fire({
                position: "top-end",
                icon: "success",
                title: "Product has been added to cart",
                showConfirmButton: false,
                timer: 1500
            });
        },

        removeCartItem(index) {
            Swal.fire({
                title: "Are you sure?",
                text: "You won't be able to revert this!",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Yes, delete it!"
            }).then((result) => {
                if (result.isConfirmed) {
                    this.cart_list.splice(index, 1);
                    localStorage.setItem('cart_list', JSON.stringify(this.cart_list));
                }
            });
        },

        addCartQty(index) {
            this.cart_list[index].qty++;
            localStorage.setItem('cart_list', JSON.stringify(this.cart_list));
        },

        removeCartQty(index) {
            if (this.cart_list[index].qty > 1) {
                this.cart_list[index].qty--;
            } else {
                this.removeCartItem(index);
                return;
            }
            localStorage.setItem('cart_list', JSON.stringify(this.cart_list));
        },

        calGrandTotal() {
            return this.cart_list.reduce((sum, item) => sum + item.qty * parseFloat(item.price), 0).toFixed(2);
        },

        async submitCheckout() {
            if (this.cart_list.length === 0) {
                Swal.fire('Cart is empty!', '', 'error');
                return;
            }

            if (!this.customer.name || !this.customer.email || !this.customer.phone || !this.customer.location || !this.customer.payment) {
                Swal.fire('Please fill all fields!', '', 'error');
                return;
            }

            localStorage.setItem('customer_info', JSON.stringify(this.customer));

            // Prepare checkout data
            const checkoutData = {
                email: this.customer.email,
                phone: this.customer.phone,
                address: this.customer.location,
                payment: this.customer.payment,
                location: this.customer.location,
                items: this.cart_list.map(i => ({
                    title: i.title,
                    price: parseFloat(i.price),
                    qty: i.qty
                })),
                subtotal: parseFloat(this.calGrandTotal()),
                shipping: parseFloat(this.shipping_fee),
                total: parseFloat(this.calGrandTotal()) + parseFloat(this.shipping_fee)
            };

            try {
                // Send order to Flask (Gmail confirmation)
                await fetch('/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(checkoutData)
                });

                // Send order to Telegram for seller
                await this.sendOrderToTelegram();

                Swal.fire({
                    icon: 'success',
                    title: 'Order Verified!',
                    html: `Thank you [[ customer.name ]]! Your order of [[ cart_list.length ]] items has been submitted.`,
                    showConfirmButton: true
                }).then(() => {
                    localStorage.removeItem('cart_list');
                    this.cart_list = [];
                    window.location.href = '/';
                });
            } catch (err) {
                Swal.fire('Error', 'Failed to process your order.', 'error');
                console.error(err);
            }
        },


        async sendOrderToTelegram() {
            const botToken = '7841722560:AAGlrPxtaHMa6CIv6QulCdD2ncc06LEoe44';
            const chatId = '935495104';

            let message = `<b>New Order Received!</b>\n\n`;
            message += `<b>Customer Name:</b> ${this.customer.name}\n`;
            message += `<b>Email:</b> ${this.customer.email}\n`;
            message += `<b>Phone:</b> ${this.customer.phone}\n`;
            message += `<b>Location:</b> ${this.customer.location}\n`;
            message += `<b>Payment:</b> ${this.customer.payment}\n\n`;
            message += `<b>Items:</b>\n`;

            this.cart_list.forEach(item => {
                message += `- ${item.title} x${item.qty}\n`;
            });

            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const payload = {
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
                // reply_markup: {
                //     inline_keyboard: [
                //         [{ text: "✅ Accept Order", callback_data: `accept_order_${Date.now()}` }]
                //     ]
                // }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!data.ok) throw new Error('Telegram API failed');
            return data;
        }
    }
}).mount('#app');
