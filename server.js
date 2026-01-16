const http = require("node:http");

/* In-memory Database */
const db = {
    tasks: [
        { id: 1, title: "Học NodeJS thuần", isCompleted: false },
        { id: 2, title: "Xây dựng REST API", isCompleted: true },
    ],
};

/* Cấu hình các domain được phép truy cập */
const allowOrigins = [
    "http://localhost:5173",
    "https://f8-fullstack-day46-frontend.vercel.app",
];

/**
 * Hàm thu thập các mảnh để lấy body của request
 */

const collectBody = (req) => {
    return new Promise((resolve) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk.toString()));
        req.on("end", () => resolve(body));
    });
};

const server = http.createServer(async (req, res) => {
    /* Cấu hình headers & CORS - khác cổng */
    const rqOrigin = req.headers.origin;
    const validOrigin = allowOrigins.find((o) => o === rqOrigin);
    const headers = {
        "Content-Type": "application/json",
    };
    if (validOrigin) headers["Access-Control-Allow-Origin"] = validOrigin;

    /* Xử lý Preflight Request (OPTIONS) */
    if (req.method === "OPTIONS") {
        headers["Access-Control-Allow-Methods"] =
            "GET, POST, PUT, DELETE, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type";
        headers["Access-Control-Max-Age"] = 86400; // Cache: 24h -> Trong 24 giờ tới, browser không cần gửi lại OPTIONS nữa.
        res.writeHead(204, headers);
        res.end();
        return;
    }

    /* [GET] /api/tasks - Lấy toàn bộ danh sách */
    if (req.method === "GET" && req.url === "/api/tasks") {
        res.writeHead(200, headers);
        res.end(JSON.stringify(db.tasks));
        return;
    }

    /* [GET] /api/tasks/:id - Lấy chi tiết 1 task */
    if (req.method === "GET" && req.url.startsWith("/api/tasks/")) {
        // parseInt: hàm chuyển đổi một chuỗi (string) thành một số nguyên (integer). VD: /12?tab=info ==> 12
        const id = parseInt(req.url.split("/").pop());
        const task = db.tasks.find((t) => t.id === id);

        // Nếu task không tồn tại
        if (!task) {
            res.writeHead(404, headers);
            res.end(JSON.stringify({ message: "Task không tồn tại" }));
            return;
        }

        res.writeHead(200, headers);
        res.end(JSON.stringify(task));
        return;
    }

    /* [POST] /api/tasks - Thêm task mới */
    if (req.method === "POST" && req.url === "/api/tasks") {
        const body = await collectBody(req);

        // Cầm dữ liệu từ Client -> Cập nhật vào db
        const { title } = JSON.parse(body);
        const newTask = {
            id:
                db.tasks.length > 0
                    ? Math.max(...db.tasks.map((t) => t.id)) + 1
                    : 1,
            title,
            isCompleted: false,
        };

        db.tasks.push(newTask);
        res.writeHead(201, headers);
        res.end(JSON.stringify(newTask));
        return;
    }

    /* [PUT] /api/tasks/:id - Cập nhật task */
    if (req.method === "PUT" && req.url.startsWith("/api/tasks/")) {
        const id = parseInt(req.url.split("/").pop());
        const body = await collectBody(req);
        const updateData = JSON.parse(body); // {title: "Học ExpressJS"}

        const index = db.tasks.findIndex((t) => t.id === id);
        // Nếu không tìm thấy task nào có id khớp với params
        if (index === -1) {
            res.writeHead(404, headers);
            res.end(JSON.stringify({ message: "Task không tồn tại" }));
            return;
        }

        // Cập nhật dữ liệu
        db.tasks[index] = { ...db.tasks[index], ...updateData };

        res.writeHead(200, headers);
        res.end(JSON.stringify(db.tasks[index]));
        return;
    }

    /* [DELETE] /api/tasks/:id - Xoá task */
    if (req.method === "DELETE" && req.url.startsWith("/api/tasks/")) {
        const id = parseInt(req.url.split("/").pop());
        const index = db.tasks.findIndex((t) => t.id === id);

        if (index === -1) {
            res.writeHead(404, headers);
            res.end(JSON.stringify({ message: "Task không tồn tại" }));
            return;
        }

        db.tasks.splice(index, 1);
        res.writeHead(200, headers);
        res.end(JSON.stringify({ message: "Xoá thành công", id }));
        return;
    }

    /* Bypass CORS 
        1. Lấy URL mục tiêu từ param `url`
        2. Gửi request đến API đó từ server
        3. Response nhận server
        4. Trả response về cho Client
    */

    if (req.url.startsWith("/bypass-cors")) {
        const fullUrl = new URL(req.url, `http://${req.headers.host}`);
        const targetUrl = fullUrl.searchParams.get("url");

        if (!targetUrl) {
            res.writeHead(400, headers);
            res.end(JSON.stringify({ error: "Thiếu tham số URL" }));
            return;
        }

        // Thu thập body nếu có (POST/PUT)
        const body = await collectBody(req);

        try {
            const response = await fetch(targetUrl, {
                method: req.method,
                headers: { "Content-Type": "application/json" },
                body: ["POST", "PUT", "PATCH"].includes(req.method)
                    ? body
                    : undefined,
            });

            // Dùng .text() để nhận mọi dạng dữ liệu (JSON, HTML, XML…).
            const result = await response.text();

            // Trả response về cho phía Client
            const targetContentType = response.headers.get("Content-Type");
            res.writeHead(200, {
                ...headers,
                "Content-Type": targetContentType,
            });
            res.end(result);
        } catch (error) {
            res.writeHead(500, headers);
            res.end(
                JSON.stringify({ error: "Lỗi khi bypass: " + error.message })
            );
        }
        return;
    }

    /* 404 - Đường dẫn không tồn tại */
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Endpoint not found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang lắng nghe tại: http://localhost:${PORT}`);
});
