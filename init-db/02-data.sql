INSERT INTO app.users (email, username, first_name, last_name, is_active) VALUES
('john.doe@example.com', 'johnd', 'John', 'Doe', true),
('jane.smith@example.com', 'janes', 'Jane', 'Smith', true),
('bob.wilson@example.com', 'bobw', 'Bob', 'Wilson', true),
('alice.johnson@example.com', 'alicej', 'Alice', 'Johnson', false),
('charlie.brown@example.com', 'charlieb', 'Charlie', 'Brown', true);

INSERT INTO app.cars (make, model, year, color, price, owner_id) VALUES
('Toyota', 'Camry', 2022, 'Silver', 28500.00, 1),
('Honda', 'Civic', 2023, 'Blue', 25000.00, 2),
('Ford', 'Mustang', 2021, 'Red', 45000.00, 1),
('BMW', '3 Series', 2023, 'Black', 52000.00, 3),
('Tesla', 'Model 3', 2024, 'White', 48000.00, NULL),
('Chevrolet', 'Corvette', 2022, 'Yellow', 65000.00, NULL),
('Audi', 'A4', 2023, 'Gray', 44000.00, 5),
('Mercedes', 'C-Class', 2022, 'Silver', 49000.00, 2);

INSERT INTO app.orders (user_id, car_id, status, total_amount) VALUES
(1, 1, 'completed', 28500.00),
(2, 2, 'completed', 25000.00),
(1, 3, 'completed', 45000.00),
(3, 4, 'pending', 52000.00),
(5, 7, 'shipped', 44000.00),
(2, 8, 'processing', 49000.00);

INSERT INTO public.categories (name, description) VALUES
('Electronics', 'Electronic devices and accessories'),
('Clothing', 'Apparel and fashion items'),
('Books', 'Physical and digital books'),
('Home & Garden', 'Home improvement and garden supplies');

INSERT INTO public.products (name, category_id, price, stock) VALUES
('Laptop Pro 15"', 1, 1299.99, 50),
('Wireless Mouse', 1, 29.99, 200),
('USB-C Hub', 1, 49.99, 150),
('Cotton T-Shirt', 2, 19.99, 500),
('Denim Jeans', 2, 59.99, 300),
('Winter Jacket', 2, 129.99, 100),
('Programming Guide', 3, 44.99, 75),
('Science Fiction Novel', 3, 14.99, 200),
('Garden Tools Set', 4, 89.99, 60),
('Indoor Plant Pot', 4, 24.99, 150);
