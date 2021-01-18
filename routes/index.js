var express = require('express');
var router = express.Router();
const bcrypt= require('bcryptjs');
const {Product}= require('../models/product');
const {User}= require('../models/user');
const {Order}= require('../models/order');
const Cart= require('../models/cart');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
var cookieParser = require('cookie-parser');

router.all('/*',(req,res,next)=> {
    req.app.locals.layout= 'layout';
    next();
})

const isLoggedout= (req,res,next)=> {
    if(! req.isAuthenticated()){  
        next();
    }else{
        req.flash('error_message',`You need to logout first.`);
        res.redirect('/');
    }
}

const isLoggedin= (req,res,next)=> {
    if(req.isAuthenticated()){
        
        User.findOne({email:req.user.email}).then((user)=> {
            req.session.cart= user.cart;
        })
//        console.log(req.session.cart);
        next();    
    }else{
        req.flash('error_message',`You need to login first.`);
        res.redirect('/');
    }
}

const isLoggedin_4_logout= (req,res,next)=> {
    if(req.isAuthenticated()){
        next();    
    }else{
//        req.flash('error_message',`You need to logout first.`);
        res.redirect('/');
    }
}


router.get('/signup',isLoggedout,(req,res,next)=> {
 
    res.render('routes_UI/signup');
})


router.get('/login',isLoggedout,(req,res,next)=> {
 
    res.render('routes_UI/login');
})


router.get('/profile',isLoggedin,(req,res,next)=> {
 
    Order.find({userEmail:req.user.email}).then((orders)=> {
        
        console.log(orders);
        res.render('routes_UI/profile',{user:req.user, orders:orders});
    })
})

router.get('/reduce/:id',(req,res)=> {
    
    let cart= new Cart(req.session.cart ? req.session.cart : {} );
    cart.reduceByOne(req.params.id);
    cart.generateArray();
    req.session.cart= cart;
    
    if(req.isAuthenticated()){ 
        User.findOne({email:req.user.email}).then((user)=> {
            user.cart= cart;  
            user.save();
            console.log(user.cart);
        })
    }
    console.log(req.session.cart);   
    res.redirect('/cart');    
})


router.get('/removeItem/:id',(req,res)=> {
    
    let cart= new Cart(req.session.cart ? req.session.cart : {} );
    cart.removeItem(req.params.id);
    cart.generateArray();
    req.session.cart= cart;
    
    if(req.isAuthenticated()){ 
        User.findOne({email:req.user.email}).then((user)=> {
            user.cart= cart;  
            user.save();
            console.log(user.cart);
        })
    } 
    console.log(req.session.cart);
    res.redirect('/cart');    
})

    

router.put('/add-to-cart/:id',(req,res,next)=> {

    let cart= new Cart(req.session.cart ? req.session.cart : {} );
    
    Product.findById(req.params.id).then((product)=> {
    
        cart.add(product, product.id);
        cart.generateArray();
        req.session.cart= cart;
        
        if(req.isAuthenticated()){
           User.findOne({email:req.user.email}).then((user)=> {
           user.cart=req.session.cart;
             user.save().then(()=>{
                  res.redirect('/'); 
             })
        })
        }else{
            res.redirect('/'); 
        }   
    }); 
});


router.get('/cart',(req,res)=> {
    
    let cart= req.session.cart || {};
    let itemsArray= cart.itemsArray ||[];
    
    res.render('routes_UI/cart',{cart, itemsArray, user:req.user});
})


router.get('/checkout',isLoggedin, (req,res)=> {
    let error_message= req.flash('error_message')[0];
    if(!req.session.cart){
        req.flash('error_message',`Add some items first.`);
        res.redirect('/cart');
    }else{
        res.render('routes_UI/checkout',{user:req.user, totalPrice:req.session.cart.totalPrice, error_message:error_message});
    }
})

router.post('/checkout',(req,res)=> {
    
    var stripe = require("stripe")("sk_test_JFyJNPEu7Ld6DOjnMxZU5CTY");

    stripe.charges.create({
      amount: req.session.cart.totalPrice * 100,
      currency: "usd",
      source: req.body.stripeToken, // obtained with Stripe.js
      description: "Charge for products."
    }, function(err, charge) {
      if(err){
          console.log(err);
          req.flash('error_message',err.message);
          return res.redirect('/checkout');
      }
        if(charge){
            
            console.log(charge);
            const newOrder= new Order({
                userEmail:req.user.email,
                order:req.user.cart,
                name:req.body.name,
                address:req.body.address,
                paymentId:charge.id,     
            })
            newOrder.save();
            
        
           User.findOne({email:req.user.email}).then((user)=> {
               
//              user.orders.push(user.cart);
//              console.log(user.orders[0]);
              req.session.cart= null;
              user.cart= null;
               
              user.save().then(()=> {
                  req.flash('success_message',`successfully bought product(s)!`);
                  res.redirect('/');
              })
           })
        }
    });
    
})
                           

router.get('/',(req, res)=> {
    

    let success_message= req.flash('success_message');

    Product.find().then((products)=> {
        
        let productChunks=[];
        const chunkSize= 4;
        for(let i=0; i<products.length; i +=chunkSize){
            productChunks.push(products.slice(i, i+chunkSize));
        }
        
        if(req.isAuthenticated()){     
            User.findOne({email:req.user.email}).then((user)=> {
                
                let x= JSON.stringify(req.session.cart);
                let y= JSON.stringify(user.cart);
                let z= (x !== y);
                
                console.log(user.cart);
                console.log(req.session.cart);
                if(req.session.cart && z){
                    
                    let cart= new Cart(user.cart ? user.cart : {} );
                
                    cart.add2(req.session.cart);
                    cart.generateArray();
                    req.session.cart= cart;
                    user.cart= cart;
                    
                    
                }else{
                    req.session.cart=user.cart;
                }   
                console.log(req.session.cart);
                user.save().then(()=> {
                    res.render('routes_UI/index', {productChunks, user:req.user,success_message});
                })     
            })          
        }
        
        else{
            res.render('routes_UI/index', {productChunks});
        }
        
    })
});


router.get('/logout',isLoggedin_4_logout,(req, res)=>{
 
    req.session.destroy();
    req.logout();
    res.redirect('/login');
    
});


router.post('/signup',(req,res)=> {
       
    if(req.body.password!==req.body.confirmPassword){
        req.flash('error_message',`Passwords do not match`);
        res.redirect('/signup');
    }else{
        
        User.findOne({ email: req.body.email}).then((user)=> {
            if(user){
               req.flash('error_message',`A user with this email already exists`);
               res.redirect('/signup');
            }else{
                    bcrypt.genSalt(10, function(err, salt) {
                    bcrypt.hash(req.body.password, salt, function(err, hash) {

                        const user= new User({
                                username:req.body.username,
                                email:req.body.email,
                                password:hash
                            });

                        user.save().then(()=> {
                            req.flash('success_message',`You have registered successfully, please login`);
                            res.redirect('/login');
                        });
                     });
                  });
            }
        })   
    }   
})


passport.use(new LocalStrategy({usernameField: 'email'},
  (email, password, done)=> {
    
    User.findOne({email:email}).then((user)=> {
        
      if (!user) {
        return done(null, false);
      }
        
        bcrypt.compare(password, user.password,(err, matched)=> {
            
                if(matched){
                    return done(null, user);
                }
                else{
                    return done(null, false);
                }
        });
    })
   }
));


passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});



router.post('/login',
  passport.authenticate('local'
                        , {successRedirect: '/',
                          failureRedirect: '/login',
                          failureFlash: 'Invalid email or password.',
                          successFlash: 'You are logged in, now you can buy products.'}
                       ));



const products= [
    new Product({
        imagePath: 'https://www.mi-home.in/wp-content/uploads/2020/03/11.jpg',
        title: 'Redmi 9 pro',
        description: '64MP Quad Camera Array, 32MP In-Display Selfie Camera, Qualcomm® Snapdragon™ 720G',
        price: 18999
    }),
    new Product({
        imagePath: 'https://images-na.ssl-images-amazon.com/images/I/61jgfLBydjL._SL1024_.jpg',
        title: 'Iphone 11 pro max',
        description: '6.5-inch Super Retina XDR OLED display, Triple-camera system with 12MP Ultra Wide, Wide, and Telephoto cameras; Night mode, Portrait mode, and 4K video up to 60fps',
        price: 119000
    }),
    new Product({
        imagePath: 'https://images.samsung.com/is/image/samsung/in-galaxy-s20-g980-sm-g980flbdinu-frontcloudblue-214061880',
        title: 'Samsung S20',
        description: 'Quad rear camera - 64MP OIS F2.0 tele camera + 12MP F2.2 ultra wide + 12MP (2PD) OIS F1.8 wide + VGA depth camera | 10MP (2PD) OIS F2.2 front punch hole camera | rear LED flash',
        price: 66599
    }),
    new Product({
        imagePath: 'https://www.jadeals.com/wp-content/uploads/Huawei-Honor-7X-Duos-Dual-Sim-black.jpg',
        title: 'Honor 7X',
        description: '4 GB RAM | 64 GB ROM | Expandable Upto 256 GB 5.93 inch Full HD+ Display16MP + 2MP Dual Rear Camera | 8MP Front Camera 3340 mAH Lithium-polymer Battery Kirin 659 Processor',
        price: 6499
    }),
    new Product({
        imagePath: 'https://images.samsung.com/is/image/samsung/ae-galaxy-j8-sm-j810fds-sm-j810fzbgxsg-frontblue-thumb-112844544',
        title: 'Samsung Galaxy J8',
        description: '15.24 cm (6 inch) HD+ Display, 1.8GHz CPU Speed, 16MP + 5MP | 16MP Front Camera,3500 mAh Battery',
        price: 15499
    }),
    new Product({
        imagePath:'https://d2xamzlzrdbdbn.cloudfront.net/products/3bc42dec-c8be-4f3f-b2b2-46574f38b5bb.jpg',
        title: 'Redmi Note 8',
        description: 'Qualcomm Snapdragon 665 13MP front Camera Android 9 Pie 48MP + 8MP + 2MP + 2MP Rear Camera 6.39-inch (1080×2340) HD+ Display Li-Po 4000 mAh battery 4|6 Gb Ram / 64|128 Gb Storage 1 Yr Brand Warranty in India',
        price: 12999
    }),
    new Product({
        imagePath:'https://static.toiimg.com/thumb/msid-64589208,width-220,resizemode-4,imgv-17/Vivo-V11-Pro.jpg',
        title: 'Vivo 11 pro',
        description: 'Vivo V11 Pro is a feature-rich Android smartphone that works on 8.1 (Oreo) OS and Octa-core (2.2 GHz, Quad core, Kryo 260 + 1.8 GHz, Quad core, Kryo 260) processor. The new Vivo V11 Pro comes with Adreno 512 to deliver commendable graphics experience to its users and is packed with 6GB of RAM',
        price: 25990
    })
]

for(let i=0; i < products.length; i++){
    
    Product.find().then((productss)=> {
        let count= 0;
        for(let j=0; j< productss.length; j++){
            if(products[i].title===productss[j].title){
               count++;
            }
        }
        if(count==0){
            products[i].save();
        }
    })
    
}


module.exports = router;
